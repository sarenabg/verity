//! Unit tests. Run with `cargo test`.

use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, PromiseResult};

const USDC: u128 = 1_000_000;
const NOW: u64 = 1_000_000_000_000;
const HOUR: u64 = 3_600_000_000_000;
const WINDOW: u64 = 48 * HOUR;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn owner() -> AccountId {
    acc("verity.near")
}
fn token() -> AccountId {
    acc("usdc.near")
}
fn judge() -> AccountId {
    acc("judge.near")
}
fn panel() -> AccountId {
    acc("panel.near")
}
fn alice() -> AccountId {
    acc("alice.near")
}
fn bob() -> AccountId {
    acc("bob.near")
}

fn ctx(caller: AccountId, time: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acc("market.near"))
        .predecessor_account_id(caller)
        .block_timestamp(time)
        .prepaid_gas(Gas::from_tgas(100))
        .build());
}

fn setup() -> Contract {
    ctx(owner(), NOW);
    let mut c = Contract::new(owner(), token(), judge(), panel(), U128(10 * USDC), U128(20 * USDC), WINDOW, U128(USDC));
    c.create_claim("everest-mallory".into(), "Did George Mallory reach the top in 1924?".into());
    pay(&mut c, owner(), 688 * USDC, r#"{"seed":{"claim":"everest-mallory","price_bps":1400}}"#);
    c
}

/// Simulate `ft_transfer_call` from `from` with this msg.
fn pay(c: &mut Contract, from: AccountId, amount: u128, msg: &str) {
    ctx(token(), NOW);
    let _ = c.ft_on_transfer(from, U128(amount), msg.to_string());
}

fn buy(c: &mut Contract, from: AccountId, side: &str, amount: u128) {
    pay(c, from, amount, &format!(r#"{{"buy":{{"claim":"everest-mallory","side":"{side}"}}}}"#));
}

fn price(c: &Contract) -> u32 {
    c.get_claim("everest-mallory".into()).unwrap().price_bps
}

#[test]
fn seeding_sets_the_starting_price() {
    let c = setup();
    assert_eq!(price(&c), 1400);
    // The owner keeps the False shares that didn't go into the pool.
    assert!(c.get_position("everest-mallory".into(), owner()).no.0 > 0);
}

#[test]
fn betting_true_raises_the_price_and_records_shares() {
    let mut c = setup();
    buy(&mut c, alice(), "yes", 100 * USDC);
    assert!((3600..3800).contains(&price(&c)), "price {}", price(&c));
    let pos = c.get_position("everest-mallory".into(), alice());
    assert!(pos.yes.0 > 100 * USDC, "each share costs under 1 USDC");
    assert!(get_logs().iter().any(|l| l.contains("\"event\":\"buy\"")));
}

#[test]
fn selling_back_returns_almost_exactly_what_was_paid() {
    let mut c = setup();
    buy(&mut c, alice(), "no", 50 * USDC);
    let shares = c.get_position("everest-mallory".into(), alice()).no;
    ctx(alice(), NOW);
    let out = c.sell("everest-mallory".into(), Side::No, shares, None);
    assert!(out.0 <= 50 * USDC && out.0 >= 50 * USDC - 2, "got {}", out.0);
    assert_eq!(c.get_credit(alice()), out);
    assert_eq!(price(&c), 1400);
}

#[test]
#[should_panic(expected = "Only the configured token is accepted")]
fn other_tokens_are_refused() {
    let mut c = setup();
    ctx(acc("fake-usdc.near"), NOW);
    let _ = c.ft_on_transfer(alice(), U128(5 * USDC), r#"{"buy":{"claim":"everest-mallory","side":"yes"}}"#.into());
}

#[test]
#[should_panic(expected = "Price moved")]
fn min_shares_protects_the_buyer() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"buy":{"claim":"everest-mallory","side":"yes","min_shares":"999000000000"}}"#);
}

#[test]
#[should_panic(expected = "below the smallest bet")]
fn dust_bets_are_refused() {
    let mut c = setup();
    buy(&mut c, alice(), "yes", 10);
}

#[test]
fn judge_can_say_cant_settle_yet_and_the_bond_comes_back() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), None, "No decisive evidence".into());
    assert_eq!(c.get_claim("everest-mallory".into()).unwrap().status, Status::Open);
    assert_eq!(c.get_credit(alice()).0, 10 * USDC);
}

#[test]
#[should_panic(expected = "Only the judge")]
fn only_the_judge_proposes() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(alice(), NOW);
    c.propose_ruling("everest-mallory".into(), Some(true), "trust me".into());
}

#[test]
#[should_panic(expected = "still open")]
fn finalize_waits_for_the_dispute_window() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), Some(false), "e".into());
    ctx(bob(), NOW + WINDOW - 1);
    c.finalize("everest-mallory".into());
}

#[test]
fn undisputed_ruling_settles_and_winners_redeem() {
    let mut c = setup();
    buy(&mut c, alice(), "no", 40 * USDC);
    buy(&mut c, bob(), "yes", 15 * USDC);
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), Some(false), "No summit photo".into());
    ctx(bob(), NOW + WINDOW);
    c.finalize("everest-mallory".into());
    assert_eq!(price(&c), 0);

    let alice_no = c.get_position("everest-mallory".into(), alice()).no.0;
    ctx(alice(), NOW + WINDOW);
    assert_eq!(c.redeem("everest-mallory".into()).0, alice_no);
    ctx(bob(), NOW + WINDOW);
    assert_eq!(c.redeem("everest-mallory".into()).0, 0, "bob bet True and loses");
    assert_eq!(c.get_credit(alice()).0, alice_no + 10 * USDC, "winnings plus the ruling bond back");
}

#[test]
fn dispute_upheld_pays_the_requester_both_bonds() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), Some(false), "e".into());
    pay(&mut c, bob(), 20 * USDC, r#"{"dispute":{"claim":"everest-mallory"}}"#);
    ctx(panel(), NOW + HOUR);
    c.panel_ruling("everest-mallory".into(), Some(false), "3 of 3 agree".into());
    assert_eq!(c.get_credit(alice()).0, 30 * USDC);
    assert_eq!(c.get_credit(bob()).0, 0);
}

#[test]
fn dispute_overturned_pays_the_disputer_both_bonds() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), Some(true), "e".into());
    pay(&mut c, bob(), 20 * USDC, r#"{"dispute":{"claim":"everest-mallory"}}"#);
    ctx(panel(), NOW + HOUR);
    c.panel_ruling("everest-mallory".into(), Some(false), "2 of 3 say False".into());
    assert_eq!(c.get_credit(bob()).0, 30 * USDC);
    assert!(matches!(c.get_claim("everest-mallory".into()).unwrap().status, Status::Settled { verdict: false, .. }));
}

#[test]
fn panel_unsure_returns_both_bonds_and_reopens() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), Some(true), "e".into());
    pay(&mut c, bob(), 20 * USDC, r#"{"dispute":{"claim":"everest-mallory"}}"#);
    ctx(panel(), NOW + HOUR);
    c.panel_ruling("everest-mallory".into(), None, "split".into());
    assert_eq!(c.get_credit(alice()).0, 10 * USDC);
    assert_eq!(c.get_credit(bob()).0, 20 * USDC);
    assert_eq!(c.get_claim("everest-mallory".into()).unwrap().status, Status::Open);
}

#[test]
#[should_panic(expected = "dispute window has closed")]
fn late_disputes_are_refused() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), Some(true), "e".into());
    testing_env!(VMContextBuilder::new().current_account_id(acc("market.near")).predecessor_account_id(token()).block_timestamp(NOW + WINDOW).build());
    let _ = c.ft_on_transfer(bob(), U128(20 * USDC), r#"{"dispute":{"claim":"everest-mallory"}}"#.into());
}

#[test]
fn every_unit_paid_in_can_be_paid_out_after_settling() {
    let mut c = setup();
    let mut paid_in = 688 * USDC;
    for (who, side, amt) in [(alice(), "yes", 37 * USDC), (bob(), "no", 120 * USDC), (alice(), "no", 9 * USDC), (bob(), "yes", 61 * USDC)] {
        buy(&mut c, who, side, amt);
        paid_in += amt;
    }
    // Bob sells half his True shares.
    let half = U128(c.get_position("everest-mallory".into(), bob()).yes.0 / 2);
    ctx(bob(), NOW);
    let out = c.sell("everest-mallory".into(), Side::Yes, half, None).0;
    let paid_out_early = out;

    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    paid_in += 10 * USDC;
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), Some(true), "e".into());
    ctx(alice(), NOW + WINDOW);
    c.finalize("everest-mallory".into());
    for who in [alice(), bob(), owner()] {
        ctx(who, NOW + WINDOW);
        c.redeem("everest-mallory".into());
    }
    let owed: u128 = [alice(), bob(), owner()].iter().map(|a| c.get_credit(a.clone()).0).sum::<u128>() - paid_out_early;
    // Everything owed (including the early sale) equals what came in, up to a few units of rounding kept by the pool.
    assert!(owed + paid_out_early <= paid_in, "contract would be insolvent: owes {} > {}", owed + paid_out_early, paid_in);
    assert!(paid_in - (owed + paid_out_early) <= 10, "too much left behind: {}", paid_in - (owed + paid_out_early));
}

#[test]
fn failed_withdrawal_puts_the_money_back() {
    let mut c = setup();
    pay(&mut c, alice(), 10 * USDC, r#"{"request_ruling":{"claim":"everest-mallory"}}"#);
    ctx(judge(), NOW);
    c.propose_ruling("everest-mallory".into(), None, "e".into());
    ctx(alice(), NOW);
    let _ = c.withdraw();
    assert_eq!(c.get_credit(alice()).0, 0);
    testing_env!(
        VMContextBuilder::new().current_account_id(acc("market.near")).predecessor_account_id(acc("market.near")).build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed]
    );
    assert!(!c.on_withdraw(alice(), U128(10 * USDC)));
    assert_eq!(c.get_credit(alice()).0, 10 * USDC);
}

#[test]
fn batch_setup_creates_and_seeds_many_facts() {
    ctx(owner(), NOW);
    let mut c = Contract::new(owner(), token(), judge(), panel(), U128(USDC), U128(2 * USDC), HOUR, U128(USDC / 10));
    c.create_claims(vec![
        NewClaim { id: "a".into(), question: "A?".into() },
        NewClaim { id: "b".into(), question: "B?".into() },
    ]);
    pay(&mut c, owner(), 4 * USDC, r#"{"seed_many":{"seeds":[{"claim":"a","price_bps":1400,"amount":"2000000"},{"claim":"b","price_bps":9900,"amount":"2000000"}]}}"#);
    assert_eq!(c.get_claim("a".into()).unwrap().price_bps, 1400);
    assert_eq!(c.get_claim("b".into()).unwrap().price_bps, 9900);
    assert_eq!(c.list_claims(None, None).len(), 2);
    // A 0.1 USDC bet is allowed with this setting, and shows up in history and in the account view.
    pay(&mut c, alice(), USDC / 10, r#"{"buy":{"claim":"a","side":"yes"}}"#);
    assert_eq!(c.get_history("a".into()).len(), 2);
    let view = c.get_account(alice());
    assert_eq!(view.positions.len(), 1);
    assert_eq!(view.positions[0].claim, "a");
}

#[test]
#[should_panic(expected = "add up")]
fn seed_many_amounts_must_match() {
    ctx(owner(), NOW);
    let mut c = Contract::new(owner(), token(), judge(), panel(), U128(USDC), U128(2 * USDC), HOUR, U128(USDC / 10));
    c.create_claims(vec![NewClaim { id: "a".into(), question: "A?".into() }]);
    pay(&mut c, owner(), 3 * USDC, r#"{"seed_many":{"seeds":[{"claim":"a","price_bps":1400,"amount":"2000000"}]}}"#);
}
