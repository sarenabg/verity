//! The market maker's math, in whole token units (USDC: 1 = 0.000001 USDC).
//!
//! Same rules as `web/src/lib/market.ts` (a fixed-product market maker), but in
//! integers. Every rounding goes in the pool's favour, so the contract can
//! always pay every winning share in full.

/// Shares received for `amount` spent on one side.
/// `ours` is the pool's reserve of the side being bought, `other` the other side.
/// Returns (shares, new_ours, new_other).
pub fn buy(ours: u128, other: u128, amount: u128) -> (u128, u128, u128) {
    assert!(ours > 0 && other > 0, "Market has no liquidity yet");
    let k = ours * other;
    let new_other = other + amount;
    let new_ours = k.div_ceil(new_other); // round up: the buyer gets slightly fewer shares
    let shares = ours + amount - new_ours;
    (shares, new_ours, new_other)
}

/// Money returned for selling `shares` of one side back to the pool.
/// Returns (amount, new_ours, new_other).
///
/// The seller adds their shares; the pool then burns `r` pairs (one of each
/// side, worth exactly 1 unit) so that `ours * other` stays at least `k`:
/// (ours + shares - r)(other - r) = k.
pub fn sell(ours: u128, other: u128, shares: u128) -> (u128, u128, u128) {
    assert!(ours > 0 && other > 0, "Market has no liquidity yet");
    let k = ours * other;
    let a = ours + shares;
    let b = other;
    let sum = a + b;
    // r = (sum - sqrt(sum² - 4(ab - k))) / 2, the smaller root.
    let disc = sum * sum - 4 * (a * b - k);
    let mut r = (sum - isqrt_ceil(disc)) / 2;
    // Integer rounding can still leave the pool a hair short; step down until it isn't.
    while r > 0 && (a - r) * (b - r) < k {
        r -= 1;
    }
    (r, a - r, b - r)
}

/// Starting pools for `liquidity` units at a True price of `price_bps` / 10_000.
/// (The web app's `seedPool(p, depth)` equals `seed(depth * max(p, 1 - p), p)`.)
/// Returns (yes, no, leftover_side_is_yes, leftover_shares): the liquidity
/// provider keeps the shares that didn't go into the pool.
pub fn seed(liquidity: u128, price_bps: u128) -> (u128, u128, bool, u128) {
    assert!((1..10_000).contains(&price_bps), "Price must be 1 to 9999 basis points");
    if price_bps <= 5_000 {
        // True is cheap: the pool holds more True shares.
        let no = liquidity * price_bps / (10_000 - price_bps);
        (liquidity, no, false, liquidity - no)
    } else {
        let yes = liquidity * (10_000 - price_bps) / price_bps;
        (yes, liquidity, true, liquidity - yes)
    }
}

/// True price in basis points (0–10_000), rounded to the nearest.
pub fn price_bps(yes: u128, no: u128) -> u128 {
    let total = yes + no;
    if total == 0 {
        return 0;
    }
    (no * 10_000 + total / 2) / total
}

/// Smallest integer whose square is at least `n`.
pub fn isqrt_ceil(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    // Newton's method for the floor square root, then round up if needed.
    let mut x = n;
    let mut y = x.div_ceil(2);
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    if x * x < n {
        x + 1
    } else {
        x
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn isqrt_is_exact_on_squares_and_rounds_up_otherwise() {
        for n in [0u128, 1, 4, 9, 1_000_000, 123_456_789u128 * 123_456_789] {
            let r = isqrt_ceil(n);
            assert_eq!(r * r, n);
        }
        assert_eq!(isqrt_ceil(2), 2);
        assert_eq!(isqrt_ceil(10), 4);
        assert_eq!(isqrt_ceil(99), 10);
    }

    #[test]
    fn seed_sets_the_price() {
        let (y, n, _, _) = seed(800_000_000, 1_400);
        assert_eq!(price_bps(y, n), 1_400);
        let (y, n, _, _) = seed(900_000_000, 7_200);
        assert_eq!(price_bps(y, n), 7_200);
    }

    #[test]
    fn buy_moves_price_and_keeps_k() {
        // The web app's Mallory pool (depth 800 at 14%) holds 688 True and 112 False:
        // the same pool as seeding 688 USDC here.
        let (y, n, _, _) = seed(688_000_000, 1_400);
        let k = y * n;
        let (shares, y2, n2) = buy(y, n, 100_000_000);
        assert!(shares > 100_000_000, "a True share costs under $1");
        assert!(y2 * n2 >= k);
        // Same as the web app: $100 moves Mallory from 14% to about 37%.
        assert!((3_600..3_800).contains(&price_bps(y2, n2)), "{}", price_bps(y2, n2));
    }

    #[test]
    fn buy_then_sell_never_pays_out_more() {
        let (y, n, _, _) = seed(1_000_000_000, 5_500);
        let (shares, y2, n2) = buy(n, y, 75_000_000); // buying No: ours = no reserve
        let (back, _, _) = sell(y2, n2, shares);
        assert!(back <= 75_000_000);
        assert!(back >= 75_000_000 - 2, "rounding loss is at most a couple of units: {back}");
    }
}
