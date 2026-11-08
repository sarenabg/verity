//! Test-network stand-in for USDC: a standard NEP-141 token with 6 decimals
//! where anyone can mint themselves test dollars. Only for testnet.

use near_contract_standards::fungible_token::metadata::{FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC};
use near_contract_standards::fungible_token::{FungibleToken, FungibleTokenCore, FungibleTokenResolver};
use near_contract_standards::storage_management::{StorageBalance, StorageBalanceBounds, StorageManagement};
use near_sdk::json_types::U128;
use near_sdk::{near, require, AccountId, NearToken, PanicOnDefault, PromiseOrValue};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self { token: FungibleToken::new(b"t".to_vec()) }
    }

    /// Give yourself (or anyone) up to 1,000 test USDC. Registers the account if needed.
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        require!(amount.0 <= 1_000_000_000, "At most 1,000 test USDC per call");
        if !self.token.accounts.contains_key(&account_id) {
            self.token.internal_register_account(&account_id);
        }
        self.token.internal_deposit(&account_id, amount.0);
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        self.token.ft_resolve_transfer(sender_id, receiver_id, amount)
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.storage_unregister(force)
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata { spec: FT_METADATA_SPEC.to_string(), name: "Test USDC".into(), symbol: "USDC".into(), icon: None, reference: None, reference_hash: None, decimals: 6 }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn as_caller(who: usize, deposit: NearToken) {
        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(who)).attached_deposit(deposit).build());
    }

    #[test]
    fn mint_registers_the_account_and_adds_to_supply() {
        as_caller(0, NearToken::from_yoctonear(0));
        let mut c = Contract::new();
        c.mint(accounts(1), U128(25_000_000));
        c.mint(accounts(1), U128(5_000_000));
        assert_eq!(c.ft_balance_of(accounts(1)).0, 30_000_000);
        assert_eq!(c.ft_total_supply().0, 30_000_000);
        assert_eq!(c.ft_metadata().decimals, 6);
    }

    #[test]
    #[should_panic(expected = "At most 1,000 test USDC per call")]
    fn mint_is_capped_per_call() {
        as_caller(0, NearToken::from_yoctonear(0));
        let mut c = Contract::new();
        c.mint(accounts(1), U128(1_000_000_001));
    }

    #[test]
    fn transfer_moves_tokens_between_registered_accounts() {
        as_caller(0, NearToken::from_yoctonear(0));
        let mut c = Contract::new();
        c.mint(accounts(1), U128(10_000_000));
        c.mint(accounts(2), U128(0));
        as_caller(1, NearToken::from_yoctonear(1));
        c.ft_transfer(accounts(2), U128(4_000_000), None);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 6_000_000);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 4_000_000);
    }
}
