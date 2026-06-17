import { rpc } from '@stellar/stellar-sdk'

export const NETWORK = {
  name: 'testnet',
  passphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
} as const

/** Deployed streaming contract address. */
export const STREAM_CONTRACT_ID =
  process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID ?? ''

/** RPC server — used for simulation and submission. */
export const server = new rpc.Server(NETWORK.rpcUrl, { allowHttp: false })

/** Common tokens on testnet. */
export const KNOWN_TOKENS = [
  {
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    symbol: 'XLM',
    decimals: 7,
  },
  {
    address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    symbol: 'USDC',
    decimals: 7,
  },
  {
    address: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUEZHRST6OAH3GZP5C7VZ6CK',
    symbol: 'EURC',
    decimals: 7,
  },
] as const
