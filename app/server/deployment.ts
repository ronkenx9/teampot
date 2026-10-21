/** Storage boundaries for an isolated deployment; this does not authorize live earning. */
export function deploymentConfig(env: NodeJS.ProcessEnv = process.env) {
  const mainnet = env.TEMPO_NETWORK === 'mainnet'
  const namespace = env.TEAMPOT_STORAGE_NAMESPACE || 'teampot'
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(namespace)) throw new Error('Invalid TEAMPOT_STORAGE_NAMESPACE')
  if (mainnet) {
    if (env.TEMPO_PAYMENT_TOKEN?.toLowerCase() !== '0x20c0000000000000000000006a37da5c996874be' || env.TEMPO_EARN_VAULT?.toLowerCase() !== '0x0d136e26b4d9e4836fc5cb202baeb49cb6f5df48') throw new Error('Mainnet activation requires the reviewed OUSD asset and vault')
    if (namespace === 'teampot') throw new Error('Mainnet requires a separate TEAMPOT_STORAGE_NAMESPACE')
    if (env.DEMO_MODE !== 'off') throw new Error('Mainnet requires DEMO_MODE=off')
    if (!(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL) || !(env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN)) throw new Error('Mainnet requires Redis credentials')
  }
  return { mainnet, namespace }
}
