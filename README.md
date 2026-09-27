# Pagoda Member Portal

Wallet-connected dashboard for the Pagoda MLM contract.

## Run locally

```sh
npm install
npm run dev
```

Connect an injected EVM wallet (such as MetaMask) on the network where the contract is deployed. The app checks for contract bytecode at `0x9244d92243f019d70810aBcf28934FbB8558c60d` on the connected chain and disables contract actions when it is unavailable.

Registration and ID renewal request an exact PGD token approval when the current allowance is insufficient. Contract treasury withdrawal is shown only to the owner wallet.

## Checks

```sh
npm run build
npm run lint
```