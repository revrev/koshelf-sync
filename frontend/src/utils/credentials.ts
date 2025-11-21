import SparkMD5 from 'spark-md5'

const HASHED_KEY_REGEX = /^[a-f0-9]{32}$/i

export function hashCredential(secret: string) {
  if (typeof secret !== 'string') return ''
  const trimmed = secret.trim()
  if (!trimmed) return ''
  return HASHED_KEY_REGEX.test(trimmed) ? trimmed.toLowerCase() : SparkMD5.hash(trimmed)
}

export function isHashed(secret: string) {
  return HASHED_KEY_REGEX.test(secret)
}
