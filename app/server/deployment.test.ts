import { describe, expect, it } from 'vitest'
import { deploymentConfig } from './deployment.js'
describe('deployment isolation', () => {
  const live = { TEMPO_PAYMENT_TOKEN: '0x20c0000000000000000000006a37da5c996874be', TEMPO_EARN_VAULT: '0x0D136e26B4D9e4836fc5cb202baeb49Cb6f5df48', TEMPO_NETWORK: 'mainnet', TEAMPOT_STORAGE_NAMESPACE: 'teampot-ousd', DEMO_MODE: 'off', UPSTASH_REDIS_REST_URL: 'https://example.com', UPSTASH_REDIS_REST_TOKEN: 'test' }
  it('rejects another asset', () => expect(() => deploymentConfig({ ...live, TEMPO_PAYMENT_TOKEN: '' })).toThrow('OUSD'))
  it('preserves legacy testnet storage', () => expect(deploymentConfig({})).toEqual({ mainnet: false, namespace: 'teampot' }))
  it('requires isolated mainnet storage', () => expect(() => deploymentConfig({ ...live, TEAMPOT_STORAGE_NAMESPACE: '' })).toThrow('separate'))
  it('rejects demo authentication', () => expect(() => deploymentConfig({ ...live, DEMO_MODE: 'on' })).toThrow('DEMO_MODE'))
  it('requires durable shared storage', () => expect(() => deploymentConfig({ ...live, UPSTASH_REDIS_REST_TOKEN: '' })).toThrow('Redis'))
  it('rejects unsafe namespaces', () => expect(() => deploymentConfig({ TEAMPOT_STORAGE_NAMESPACE: '../demo' })).toThrow('Invalid'))
  it('accepts isolated settings without claiming funding readiness', () => expect(deploymentConfig(live)).toEqual({ mainnet: true, namespace: 'teampot-ousd' }))
})
