var Buffer = require('safe-buffer').Buffer
var createHash = require('create-hash')
var pbkdf2 = require('pbkdf2').pbkdf2Sync

var ENGLISH_WORDLIST = require('./wordlists/english.json')
var DEFAULT_WORDLIST = ENGLISH_WORDLIST

var INVALID_MNEMONIC = 'Invalid mnemonic'
var INVALID_ENTROPY = 'Invalid entropy'
var INVALID_CHECKSUM = 'Invalid mnemonic checksum'

function lpad (str, padString, length) {
  while (str.length < length) str = padString + str
  return str
}

function binaryToByte (bin) {
  return parseInt(bin, 2)
}

function bytesToBinary (bytes) {
  return bytes.map(function (x) {
    return lpad(x.toString(2), '0', 8)
  }).join('')
}

function deriveChecksumBits (entropyBuffer) {
  var ENT = entropyBuffer.length * 8
  var CS = ENT / 32
  var hash = createHash('sha256').update(entropyBuffer).digest()

  return bytesToBinary([].slice.call(hash)).slice(0, CS)
}

function salt (password) {
  return 'mnemonic' + (password || '')
}

function mnemonicToSeed (mnemonic, password = '') {
  var mnemonicBuffer = Buffer.from(mnemonic.normalize('NFKD'), 'utf8')
  var saltBuffer = Buffer.from(salt(password.normalize('NFKD')), 'utf8')

  return pbkdf2(mnemonicBuffer, saltBuffer, 2048, 64, 'sha512')
}

function mnemonicToEntropy (mnemonic, wordlist) {
  wordlist = wordlist || DEFAULT_WORDLIST

  var words = mnemonic.normalize('NFKD').split(' ')
  if (words.length % 3 !== 0) throw new Error(INVALID_MNEMONIC)

  // convert word indices to 11 bit binary strings
  var bits = words.map(function (word) {
    var index = wordlist.indexOf(word)
    if (index === -1) throw new Error(INVALID_MNEMONIC)

    return lpad(index.toString(2), '0', 11)
  }).join('')

  // split the binary string into ENT/CS
  var dividerIndex = Math.floor(bits.length / 33) * 32
  var entropyBits = bits.slice(0, dividerIndex)
  var checksumBits = bits.slice(dividerIndex)

  // calculate the checksum and compare
  var entropyBytes = entropyBits.match(/(.{1,8})/g).map(binaryToByte)
  if (entropyBytes.length < 16) throw new Error(INVALID_ENTROPY)
  if (entropyBytes.length > 32) throw new Error(INVALID_ENTROPY)
  if (entropyBytes.length % 4 !== 0) throw new Error(INVALID_ENTROPY)

  var entropy = Buffer.from(entropyBytes)
  var newChecksum = deriveChecksumBits(entropy)
  if (newChecksum !== checksumBits) throw new Error(INVALID_CHECKSUM)

  return entropy.toString('hex')
}

function validateMnemonic (mnemonic, wordlist) {
  try {
    mnemonicToEntropy(mnemonic, wordlist)
  } catch (e) {
    return false
  }

  return true
}

module.exports = {
  mnemonicToSeed: mnemonicToSeed,
  validateMnemonic: validateMnemonic,
}
