# Teampot pass 6A: personal wallet and pay-to-stocks (Codex brief)

Rules from BUILD_BRIEF.md apply: testnet only; never touch app/.env.deploy, app/.env.local or app/.vercel; no deploy or push; no AI attribution; git is read-only in your sandbox (leave changes uncommitted). Use PORT=8790. Only edit inside app/.

## Idea
"Your pay never has to leave." Every person's Teampot account is where their work money lives: keep it, earn on it, invest it, spend it, without bridging out. The headline feature is **pay-to-stocks**: a person chooses to receive part of each payday as tokenized-stock value (for example 20% into AAPL). When the stock goes up, their pay grew.

## Facts verified by Claude
- No tokenized stocks are live on Tempo yet; Ondo/xStocks live on Solana, Ethereum and BNB Chain.
- Tempo has an enshrined DEX in viem/tempo actions dex.*: createPair, place, buy, sell, getBuyQuote, getOrderbook.
- Anyone can create TIP-20 tokens: token.create(name, symbol, currency, quoteToken, admin).
- There is no public testnet Earn vault. `viem/tempo` has earn/deployment.js (an experimental ERC-4626 Earn stack you can deploy yourself).

## Build
1. **Personal accounts people control.** Today `person.address` comes from a random key that was thrown away, so salary sent there can't be spent. Give every person a personal account from a key derived from the server secret plus epoch plus personId (demo, like department roots). Payday pays there. Passkey users: document the path where their passkey becomes the account root later; don't block on it.
2. **Test stock tokens on Tempo.**
   - The company issues TIP-20 test tokens tAAPL, tNVDA and tSPY, clearly named as test assets, with pathUSD as the quote token.
   - Create DEX pairs, and keep company-placed bid and ask orders around a live reference price. Fetch real prices from a free no-key source (try Stooq CSV, https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv) with a cached fallback, and label prices "delayed".
   - Every buy and sell is a real trade on Tempo's DEX.
3. **Pay-to-stocks.**
   - Per person: "Invest X% of each payday into <stock>".
   - On payday, after salary lands, the person's account buys the stock on the DEX for that share. Show the holdings, average cost, current value and gain or loss.
   - It's also available as a manual "Buy / Sell" from the wallet.
4. **Earn.** Try deploying the experimental Earn stack from earn/deployment.js on Moderato, with pathUSD as the asset, and let people move idle balance into it ("Earning" card). If deployment isn't possible, keep it as a clearly labelled Simulated card and document exactly why in VERIFIED.md.
5. **Wallet UI** (employee and contractor phone views get a "Money" home):
   - total balance
   - Spend (department card, existing)
   - Keep (cash)
   - Earn
   - Invest (holdings and pay-to-stocks setting)
   - recent activity, each item with its receipt
   No crypto vocabulary in the app UI (the banned list still applies). Say "stock", "shares", "invest" and "earning"; stock tokens show as "AAPL (test)".
6. **Honesty.** VERIFIED.md gets every new on-chain claim with transaction hashes. Mark the test assets and their prices as test or delayed, and note the mainnet path (real tokenized stocks such as Ondo or xStocks bridged in, or issued natively on Tempo).

## Gates
- All existing gates must still pass.
- New e2e: payday with a 20% AAPL election → the person holds tAAPL bought on the DEX (tx) → a manual sell works (tx) → holdings and value show in state.
- Earn: real deposit tx, or a documented, labelled simulation.
- Update HANDOFF ("pass 6A").
