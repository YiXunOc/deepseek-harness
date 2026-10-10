import { expect, it } from 'vitest'
import { portableLocalTestNoPolicy } from '../src/portable-local-test-policy.ts'

it('registers inert mandatory status only for an explicit unsigned local test package', () => {
  expect(portableLocalTestNoPolicy({ dshPortableLocalTestNoPolicy: true }, undefined, true)).toBe(true)
  expect(portableLocalTestNoPolicy({}, undefined, false)).toBe(false)
  expect(portableLocalTestNoPolicy({}, { origin: 'https://policy.example/' }, false)).toBe(false)
  expect(() => portableLocalTestNoPolicy({ dshPortableLocalTestNoPolicy: true }, undefined, false)).toThrow('marked Portable launch')
  expect(() => portableLocalTestNoPolicy({ dshPortableLocalTestNoPolicy: true }, { origin: 'https://policy.example/' }, true)).toThrow('conflicts')
  expect(() => portableLocalTestNoPolicy({ dshPortableLocalTestNoPolicy: 'true' }, undefined, true)).toThrow('invalid')
})
