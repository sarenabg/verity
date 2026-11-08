//! # Verity market contract
//!
//! Every fact in the encyclopedia has a market here: a pool of True and False
//! shares. A share of the right answer pays 1 USDC if the fact is ever
//! settled, so the True price is the market's confidence in the fact.
//!
//! - **Markets never close.** You can buy, or sell back to the pool, at any
//!   time until a fact is settled.
//! - **Settling is optional.** Anyone can ask for a ruling by posting a bond.
//!   The `judge` (an AI agent running on NEAR AI in a TEE) proposes True,
//!   False, or "can't settle yet". Anyone can dispute a proposal within the
//!   dispute window by posting a bigger bond; the `panel` (several AI models,
//!   majority wins) then decides. Without a dispute, anyone can `finalize`
//!   after the window.
//! - **Money in** arrives as USDC with `ft_transfer_call`. NEAR Intents can
//!   turn any coin on any chain into USDC on NEAR first.
//! - **Money out** goes to an internal balance (`credits`), withdrawn with
//!   `withdraw`. A failed transfer puts the money back.
//!
//! Amounts are in the token's smallest unit (USDC has 6 decimals).

pub mod math;

use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    Promise, PromiseError, PromiseOrValue,
};

const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(10);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(10);
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
const MAX_PAGE: u32 = 100;
/// Price points kept per fact for the chart (oldest dropped first).
const HISTORY_MAX: usize = 120;
const EVENT_STANDARD: &str = "verity";
const EVENT_VERSION: &str = "1.0.0";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

#[near(serializers = [json, borsh])]
#[serde(rename_all = "lowercase")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    Yes,
    No,
}

/// Where a fact is in its life.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
    /// Trading. Nobody has asked for a ruling.
    Open,
    /// Someone posted a bond and asked the judge for a ruling.
    Judging { requester: AccountId },
    /// The judge proposed an answer. It becomes final after the dispute window.
    Proposed {
        requester: AccountId,
        verdict: bool,
        proposed_at_ns: u64,
        evidence: String,
    },
    /// Someone disputed the proposal. The panel decides.
    Disputed {
        requester: AccountId,
        disputer: AccountId,
        verdict: bool,
        evidence: String,
    },
    /// Final. Winning shares can be redeemed for 1 unit each.
    Settled { verdict: bool, evidence: String },
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Claim {
    pub question: String,
    pub yes: u128,
    pub no: u128,
    pub volume: u128,
    pub status: Status,
    /// (unix seconds, True price in basis points) after each change.
    pub history: Vec<(u64, u32)>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ClaimView {
    pub id: String,
    pub question: String,
    /// Pool reserves.
    pub yes: U128,
    pub no: U128,
    /// True price in basis points (1400 = 14%).
    pub price_bps: u32,
    pub volume: U128,
    pub status: Status,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Position {
    pub yes: U128,
    pub no: U128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PositionView {
    pub claim: String,
    pub yes: U128,
    pub no: U128,
}

/// Everything one account has here, in one call.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AccountView {
    /// Ready to withdraw.
    pub credit: U128,
    pub positions: Vec<PositionView>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct NewClaim {
    pub id: String,
    pub question: String,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct SeedItem {
    pub claim: String,
    pub price_bps: u32,
    pub amount: U128,
}

/// What `msg` in `ft_transfer_call` asks the contract to do with the money.
#[near(serializers = [json])]
#[serde(rename_all = "snake_case")]
pub enum TransferMsg {
    /// Bet on a fact.
    Buy {
        claim: String,
        side: Side,
        min_shares: Option<U128>,
    },
    /// Owner only: give a new fact its starting liquidity and price.
    Seed { claim: String, price_bps: u32 },
    /// Owner only: seed many facts in one transfer. Amounts must add up to the transfer.
    SeedMany { seeds: Vec<SeedItem> },
    /// Post the ruling bond and ask the judge to settle a fact.
    RequestRuling { claim: String },
    /// Post the dispute bond against a proposed ruling.
    Dispute { claim: String },
}

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Claims,
    Positions,
    Credits,
}

#[ext_contract(ext_ft)]
#[allow(dead_code)]
trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[ext_contract(ext_self)]
#[allow(dead_code)]
trait SelfCallbacks {
    fn on_withdraw(&mut self, account: AccountId, amount: U128) -> bool;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Adds facts and seeds their liquidity. Gets back the pool's leftover
    /// winning shares when a fact settles.
    owner: AccountId,
    /// The USDC (NEP-141) contract.
    token: AccountId,
    /// Proposes rulings (an AI agent on NEAR AI).
    judge: AccountId,
    /// Decides disputes (a panel of AI models, majority wins).
    panel: AccountId,
    ruling_bond: u128,
    dispute_bond: u128,
    dispute_window_ns: u64,
    /// Smallest bet, so storage isn't filled with dust positions.
    min_bet: u128,
    claims: IterableMap<String, Claim>,
    positions: LookupMap<String, Position>,
    credits: LookupMap<AccountId, u128>,
}

#[near]
impl Contract {
    #[init]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        owner: AccountId,
        token: AccountId,
        judge: AccountId,
        panel: AccountId,
        ruling_bond: U128,
        dispute_bond: U128,
        dispute_window_ns: u64,
        min_bet: U128,
    ) -> Self {
        Self {
            owner,
            token,
            judge,
            panel,
            ruling_bond: ruling_bond.0,
            dispute_bond: dispute_bond.0,
            dispute_window_ns,
            min_bet: min_bet.0,
            claims: IterableMap::new(StorageKey::Claims),
            positions: LookupMap::new(StorageKey::Positions),
            credits: LookupMap::new(StorageKey::Credits),
        }
    }

    // -----------------------------------------------------------------------
    // Owner
    // -----------------------------------------------------------------------

    /// Add a fact. It can be traded once it is seeded (see `TransferMsg::Seed`).
    pub fn create_claim(&mut self, id: String, question: String) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner can add facts");
        self.internal_create(id, question);
    }

    /// Add many facts in one call.
    pub fn create_claims(&mut self, claims: Vec<NewClaim>) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner can add facts");
        for c in claims {
            self.internal_create(c.id, c.question);
        }
    }

    // -----------------------------------------------------------------------
    // Money in
    // -----------------------------------------------------------------------

    /// Called by the USDC contract after `ft_transfer_call`. Any error refunds
    /// the whole amount (the token contract handles that).
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        require!(env::predecessor_account_id() == self.token, "Only the configured token is accepted");
        let parsed: TransferMsg = serde_json::from_str(&msg).unwrap_or_else(|_| env::panic_str("Unknown msg"));
        match parsed {
            TransferMsg::Buy { claim, side, min_shares } => self.internal_buy(&sender_id, &claim, side, amount.0, min_shares.map(|m| m.0).unwrap_or(0)),
            TransferMsg::Seed { claim, price_bps } => self.internal_seed(&sender_id, &claim, price_bps, amount.0),
            TransferMsg::SeedMany { seeds } => {
                let total: u128 = seeds.iter().map(|s| s.amount.0).sum();
                require!(total == amount.0, "Seed amounts must add up to the amount sent");
                for item in seeds {
                    self.internal_seed(&sender_id, &item.claim, item.price_bps, item.amount.0);
                }
            }
            TransferMsg::RequestRuling { claim } => self.internal_request(&sender_id, &claim, amount.0),
            TransferMsg::Dispute { claim } => self.internal_dispute(&sender_id, &claim, amount.0),
        }
        PromiseOrValue::Value(U128(0))
    }

    // -----------------------------------------------------------------------
    // Trading
    // -----------------------------------------------------------------------

    /// Sell shares back to the pool at today's price. The money goes to your
    /// balance; call `withdraw` to receive it.
    pub fn sell(&mut self, claim: String, side: Side, shares: U128, min_out: Option<U128>) -> U128 {
        let account = env::predecessor_account_id();
        let mut c = self.claim_or_panic(&claim);
        require!(!matches!(c.status, Status::Settled { .. }), "Fact is settled: use redeem");
        let key = pos_key(&claim, &account);
        let mut pos = self.positions.get(&key).copied().unwrap_or_default();
        let held = side_of(&pos, side);
        require!(shares.0 > 0 && shares.0 <= held, "You don't hold that many shares");
        let (ours, other) = reserves(&c, side);
        let (out, new_ours, new_other) = math::sell(ours, other, shares.0);
        require!(out >= min_out.map(|m| m.0).unwrap_or(0), "Price moved: you would receive less than min_out");
        set_reserves(&mut c, side, new_ours, new_other);
        record(&mut c);
        set_side(&mut pos, side, held - shares.0);
        self.positions.insert(key, pos);
        self.claims.insert(claim.clone(), c.clone());
        self.add_credit(&account, out);
        emit("sell", json!({ "claim": claim, "account": account, "side": side, "shares": shares, "amount": U128(out), "price_bps": math::price_bps(c.yes, c.no) as u32 }));
        U128(out)
    }

    // -----------------------------------------------------------------------
    // Settling
    // -----------------------------------------------------------------------

    /// Judge only: answer a ruling request. `None` means "can't settle yet":
    /// the requester gets their bond back and trading simply continues.
    pub fn propose_ruling(&mut self, claim: String, verdict: Option<bool>, evidence: String) {
        require!(env::predecessor_account_id() == self.judge, "Only the judge can propose rulings");
        let mut c = self.claim_or_panic(&claim);
        let Status::Judging { requester } = c.status.clone() else { env::panic_str("No ruling was requested") };
        match verdict {
            None => {
                self.add_credit(&requester, self.ruling_bond);
                c.status = Status::Open;
            }
            Some(v) => {
                c.status = Status::Proposed { requester, verdict: v, proposed_at_ns: env::block_timestamp(), evidence: evidence.clone() };
            }
        }
        self.claims.insert(claim.clone(), c);
        emit("ruling_proposed", json!({ "claim": claim, "verdict": verdict, "evidence": evidence }));
    }

    /// Anyone: make an undisputed ruling final once the dispute window has passed.
    pub fn finalize(&mut self, claim: String) {
        let c = self.claim_or_panic(&claim);
        let Status::Proposed { requester, verdict, proposed_at_ns, evidence } = c.status.clone() else {
            env::panic_str("Nothing to finalize")
        };
        require!(env::block_timestamp() >= proposed_at_ns + self.dispute_window_ns, "The dispute window is still open");
        self.add_credit(&requester, self.ruling_bond);
        self.settle(&claim, verdict, evidence);
    }

    /// Panel only: decide a disputed ruling.
    /// - Agrees with the judge: settled; the requester gets both bonds.
    /// - Overturns it: settled the other way; the disputer gets both bonds.
    /// - Can't settle: both bonds go back and trading continues.
    pub fn panel_ruling(&mut self, claim: String, verdict: Option<bool>, evidence: String) {
        require!(env::predecessor_account_id() == self.panel, "Only the panel can decide disputes");
        let mut c = self.claim_or_panic(&claim);
        let Status::Disputed { requester, disputer, verdict: proposed, .. } = c.status.clone() else {
            env::panic_str("This fact is not disputed")
        };
        let both = self.ruling_bond + self.dispute_bond;
        match verdict {
            None => {
                self.add_credit(&requester, self.ruling_bond);
                self.add_credit(&disputer, self.dispute_bond);
                c.status = Status::Open;
                self.claims.insert(claim.clone(), c);
                emit("dispute_unsettled", json!({ "claim": claim }));
            }
            Some(v) => {
                self.add_credit(if v == proposed { &requester } else { &disputer }, both);
                self.settle(&claim, v, evidence);
            }
        }
    }

    /// After a fact settles: turn your winning shares into balance (1 unit each).
    pub fn redeem(&mut self, claim: String) -> U128 {
        let account = env::predecessor_account_id();
        let c = self.claim_or_panic(&claim);
        let Status::Settled { verdict, .. } = c.status else { env::panic_str("Fact is not settled yet") };
        let key = pos_key(&claim, &account);
        let pos = self.positions.get(&key).copied().unwrap_or_default();
        let won = if verdict { pos.yes.0 } else { pos.no.0 };
        self.positions.remove(&key);
        self.add_credit(&account, won);
        emit("redeem", json!({ "claim": claim, "account": account, "amount": U128(won) }));
        U128(won)
    }

    // -----------------------------------------------------------------------
    // Money out
    // -----------------------------------------------------------------------

    /// Send your whole balance to your account.
    pub fn withdraw(&mut self) -> Promise {
        let account = env::predecessor_account_id();
        let amount = self.credits.get(&account).copied().unwrap_or(0);
        require!(amount > 0, "Nothing to withdraw");
        require!(env::prepaid_gas() >= GAS_FOR_FT_TRANSFER.saturating_add(GAS_FOR_CALLBACK).saturating_add(Gas::from_tgas(5)), "Attach at least 25 TGas");
        self.credits.remove(&account);
        ext_ft::ext(self.token.clone())
            .with_attached_deposit(ONE_YOCTO)
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(account.clone(), U128(amount), Some("Verity withdrawal".into()))
            .then(ext_self::ext(env::current_account_id()).with_static_gas(GAS_FOR_CALLBACK).on_withdraw(account, U128(amount)))
    }

    /// If the transfer failed, put the money back on the balance.
    #[private]
    pub fn on_withdraw(&mut self, account: AccountId, amount: U128) -> bool {
        let ok = env::promise_results_count() == 1 && !matches!(env::promise_result_checked(0, 16), Err(PromiseError::Failed));
        if !ok {
            self.add_credit(&account, amount.0);
        }
        ok
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    pub fn get_claim(&self, id: String) -> Option<ClaimView> {
        self.claims.get(&id).map(|c| view(&id, c))
    }

    pub fn list_claims(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<ClaimView> {
        self.claims
            .iter()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(MAX_PAGE).min(MAX_PAGE) as usize)
            .map(|(id, c)| view(id, c))
            .collect()
    }

    pub fn get_position(&self, claim: String, account: AccountId) -> Position {
        self.positions.get(&pos_key(&claim, &account)).copied().unwrap_or_default()
    }

    /// Price points for the chart: (unix seconds, True price in basis points).
    pub fn get_history(&self, claim: String) -> Vec<(u64, u32)> {
        self.claims.get(&claim).map(|c| c.history.clone()).unwrap_or_default()
    }

    /// Balance and every position of one account.
    pub fn get_account(&self, account: AccountId) -> AccountView {
        let positions = self
            .claims
            .keys()
            .filter_map(|id| {
                let p = self.positions.get(&pos_key(id, &account))?;
                (p.yes.0 > 0 || p.no.0 > 0).then(|| PositionView { claim: id.clone(), yes: p.yes, no: p.no })
            })
            .collect();
        AccountView { credit: U128(self.credits.get(&account).copied().unwrap_or(0)), positions }
    }

    pub fn get_credit(&self, account: AccountId) -> U128 {
        U128(self.credits.get(&account).copied().unwrap_or(0))
    }

    /// Shares you would get for `amount` on `side`, without trading.
    pub fn quote_buy(&self, claim: String, side: Side, amount: U128) -> U128 {
        let c = self.claim_or_panic(&claim);
        let (ours, other) = reserves(&c, side);
        U128(math::buy(ours, other, amount.0).0)
    }

    pub fn get_config(&self) -> serde_json::Value {
        json!({
            "owner": self.owner, "token": self.token, "judge": self.judge, "panel": self.panel,
            "ruling_bond": U128(self.ruling_bond), "dispute_bond": U128(self.dispute_bond),
            "dispute_window_ns": self.dispute_window_ns, "min_bet": U128(self.min_bet),
        })
    }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

impl Contract {
    fn claim_or_panic(&self, id: &str) -> Claim {
        self.claims.get(id).cloned().unwrap_or_else(|| env::panic_str("Unknown fact"))
    }

    fn add_credit(&mut self, account: &AccountId, amount: u128) {
        if amount == 0 {
            return;
        }
        let now = self.credits.get(account).copied().unwrap_or(0);
        self.credits.insert(account.clone(), now + amount);
    }

    fn internal_create(&mut self, id: String, question: String) {
        assert_valid_id(&id);
        require!(!question.is_empty() && question.len() <= 280, "Question must be 1 to 280 characters");
        require!(self.claims.get(&id).is_none(), "Fact already exists");
        self.claims.insert(id.clone(), Claim { question, yes: 0, no: 0, volume: 0, status: Status::Open, history: Vec::new() });
        emit("claim_created", json!({ "claim": id }));
    }

    fn internal_buy(&mut self, account: &AccountId, claim: &str, side: Side, amount: u128, min_shares: u128) {
        require!(amount >= self.min_bet, "Bet is below the smallest bet");
        let mut c = self.claim_or_panic(claim);
        require!(!matches!(c.status, Status::Settled { .. }), "Fact is settled");
        let (ours, other) = reserves(&c, side);
        let (shares, new_ours, new_other) = math::buy(ours, other, amount);
        require!(shares >= min_shares, "Price moved: you would receive fewer than min_shares");
        set_reserves(&mut c, side, new_ours, new_other);
        record(&mut c);
        c.volume += amount;
        let key = pos_key(claim, account);
        let mut pos = self.positions.get(&key).copied().unwrap_or_default();
        let held = side_of(&pos, side);
        set_side(&mut pos, side, held + shares);
        self.positions.insert(key, pos);
        self.claims.insert(claim.to_string(), c.clone());
        emit("buy", json!({ "claim": claim, "account": account, "side": side, "amount": U128(amount), "shares": U128(shares), "price_bps": math::price_bps(c.yes, c.no) as u32 }));
    }

    fn internal_seed(&mut self, sender: &AccountId, claim: &str, price_bps: u32, amount: u128) {
        require!(*sender == self.owner, "Only the owner can seed a fact");
        let mut c = self.claim_or_panic(claim);
        require!(c.yes == 0 && c.no == 0, "Fact is already seeded");
        let (yes, no, leftover_is_yes, leftover) = math::seed(amount, price_bps as u128);
        c.yes = yes;
        c.no = no;
        record(&mut c);
        self.claims.insert(claim.to_string(), c);
        let key = pos_key(claim, sender);
        let mut pos = self.positions.get(&key).copied().unwrap_or_default();
        let side = if leftover_is_yes { Side::Yes } else { Side::No };
        let held = side_of(&pos, side);
        set_side(&mut pos, side, held + leftover);
        self.positions.insert(key, pos);
        emit("seed", json!({ "claim": claim, "liquidity": U128(amount), "price_bps": price_bps }));
    }

    fn internal_request(&mut self, sender: &AccountId, claim: &str, amount: u128) {
        require!(amount == self.ruling_bond, "Send exactly the ruling bond");
        let mut c = self.claim_or_panic(claim);
        require!(c.status == Status::Open, "A ruling is already in progress or done");
        c.status = Status::Judging { requester: sender.clone() };
        self.claims.insert(claim.to_string(), c);
        emit("ruling_requested", json!({ "claim": claim, "requester": sender }));
    }

    fn internal_dispute(&mut self, sender: &AccountId, claim: &str, amount: u128) {
        require!(amount == self.dispute_bond, "Send exactly the dispute bond");
        let mut c = self.claim_or_panic(claim);
        let Status::Proposed { requester, verdict, proposed_at_ns, evidence } = c.status.clone() else {
            env::panic_str("There is no proposed ruling to dispute")
        };
        require!(env::block_timestamp() < proposed_at_ns + self.dispute_window_ns, "The dispute window has closed");
        c.status = Status::Disputed { requester, disputer: sender.clone(), verdict, evidence };
        self.claims.insert(claim.to_string(), c);
        emit("disputed", json!({ "claim": claim, "disputer": sender }));
    }

    /// Freeze the market. The pool's own winning shares go to the owner, who
    /// provided the liquidity, so every unit in the contract has an owner.
    fn settle(&mut self, claim: &str, verdict: bool, evidence: String) {
        let mut c = self.claim_or_panic(claim);
        let pool_winning = if verdict { c.yes } else { c.no };
        let owner = self.owner.clone();
        self.add_credit(&owner, pool_winning);
        c.yes = 0;
        c.no = 0;
        c.status = Status::Settled { verdict, evidence: evidence.clone() };
        let now = env::block_timestamp() / 1_000_000_000;
        c.history.push((now, if verdict { 10_000 } else { 0 }));
        self.claims.insert(claim.to_string(), c);
        emit("settled", json!({ "claim": claim, "verdict": verdict, "evidence": evidence }));
    }
}

/// Add the current price to the fact's chart.
fn record(c: &mut Claim) {
    let now = env::block_timestamp() / 1_000_000_000;
    c.history.push((now, math::price_bps(c.yes, c.no) as u32));
    if c.history.len() > HISTORY_MAX {
        c.history.remove(0);
    }
}

fn view(id: &str, c: &Claim) -> ClaimView {
    let price_bps = match c.status {
        Status::Settled { verdict, .. } => if verdict { 10_000 } else { 0 },
        _ => math::price_bps(c.yes, c.no) as u32,
    };
    ClaimView { id: id.to_string(), question: c.question.clone(), yes: U128(c.yes), no: U128(c.no), price_bps, volume: U128(c.volume), status: c.status.clone() }
}

fn reserves(c: &Claim, side: Side) -> (u128, u128) {
    match side {
        Side::Yes => (c.yes, c.no),
        Side::No => (c.no, c.yes),
    }
}

fn set_reserves(c: &mut Claim, side: Side, ours: u128, other: u128) {
    match side {
        Side::Yes => (c.yes, c.no) = (ours, other),
        Side::No => (c.no, c.yes) = (ours, other),
    }
}

fn side_of(p: &Position, side: Side) -> u128 {
    match side {
        Side::Yes => p.yes.0,
        Side::No => p.no.0,
    }
}

fn set_side(p: &mut Position, side: Side, v: u128) {
    match side {
        Side::Yes => p.yes = U128(v),
        Side::No => p.no = U128(v),
    }
}

fn pos_key(claim: &str, account: &AccountId) -> String {
    format!("{claim}|{account}")
}

fn assert_valid_id(id: &str) {
    require!(!id.is_empty() && id.len() <= 64, "Fact id must be 1 to 64 characters");
    require!(id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-'), "Fact id may only contain a-z, 0-9 and '-'");
}

fn emit(event: &str, data: serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({ "standard": EVENT_STANDARD, "version": EVENT_VERSION, "event": event, "data": [data] })
    ));
}

#[cfg(test)]
mod tests;
