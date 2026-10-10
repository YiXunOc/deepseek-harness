/** Explicitly opt out of policy only for unsigned, local Portable test artifacts. */
export function portableLocalTestNoPolicy(manifest: Record<string, unknown>, policy: unknown, portable: boolean): boolean {
  const marker = manifest.dshPortableLocalTestNoPolicy
  if (marker !== undefined && marker !== true) throw new Error('desktop policy: invalid Portable local-test marker')
  if (marker === true && policy !== undefined) throw new Error('desktop policy: Portable local-test marker conflicts with policy')
  if (marker === true && !portable) throw new Error('desktop policy: Portable local-test marker requires a marked Portable launch')
  return marker === true
}
