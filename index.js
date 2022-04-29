require('./config')
const { default: botConnect, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateForwardMessageContent, prepareWAMessageMedia, generateWAMessageFromContent, generateMessageID, downloadContentFromMessage, makeInMemoryStore, jidDecode, proto } = require("@adiwajshing/baileys")
const { state, saveState } = useSingleFileAuthState(`./${sessionName}.json`)
const pino = require('pino')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const  { Boom } = require('@hapi/boom')
const PhoneNumber = require('awesome-phonenumber')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, await, sleep } = require('./lib/myfunc')
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
async function startbot() {
let { version, isLatest } = await fetchLatestBaileysVersion()
const bot = botConnect({
logger: pino({ level: 'silent' }),
printQRInTerminal: true,
browser: ['whatsapp-bot','Safari','1.0.0'],
auth: state,
version
})
store.bind(bot.ev)
bot.ev.on('messages.upsert', async chatUpdate => {
try {
mek = chatUpdate.messages[0]
if (!mek.message) return
mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
if (mek.key && mek.key.remoteJid === 'status@broadcast') return
if (!bot.public && !mek.key.fromMe && chatUpdate.type === 'notify') return
if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return
m = smsg(bot, mek, store)
require("./plugins/__")(bot, m, chatUpdate, store)
} catch (err) {
console.log(err)
}
})
bot.decodeJid = (jid) => {
if (!jid) return jid
if (/:\d+@/gi.test(jid)) {
let decode = jidDecode(jid) || {}
return decode.user && decode.server && decode.user + '@' + decode.server || jid
} else return jid
}
bot.ev.on('contacts.update', update => {
for (let contact of update) {
let id = bot.decodeJid(contact.id)
if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
}
})
bot.public = true
bot.serializeM = (m) => smsg(bot, m, store)
bot.ev.on('connection.update', async (update) => {
const { connection, lastDisconnect } = update	    
if (connection === 'close') {
let reason = new Boom(lastDisconnect?.error)?.output?.statusCode
if (reason === DisconnectReason.badSession) { console.log("[ CONNECTION UPDATE ] => Bad Session File, Please Delete Session and Scan Again"); process.exit(); }
else if (reason === DisconnectReason.connectionClosed) { console.log("[ CONNECTION UPDATE ] => Connection closed, Reconnecting...."); startbot(); }
else if (reason === DisconnectReason.connectionLost) { console.log("[ CONNECTION UPDATE ] => Connection Lost from Server, Reconnecting..."); startbot(); }
else if (reason === DisconnectReason.connectionReplaced) { console.log("[ CONNECTION UPDATE ] => Connection Replaced, Another New Session Opened, Please Close Current Session First"); process.exit(); }
else if (reason === DisconnectReason.loggedOut) { console.log("[ CONNECTION UPDATE ] => Device Logged Out, Please Delete Session And Scan Again."); process.exit(); }
else if (reason === DisconnectReason.restartRequired) { console.log("[ CONNECTION UPDATE ] => Restart Required, Restarting..."); startbot(); }
else if (reason === DisconnectReason.timedOut) { console.log("[ CONNECTION UPDATE ] => Connection TimedOut, Reconnecting..."); startbot(); }
else { console.log(`Unknown DisconnectReason: ${reason}|${connection}`) }
}
console.log('[ CONNECTION UPDATE ] => Connected.', update)
})
bot.ev.on('creds.update', saveState)
 /**
 * 
 * @param {*} jid 
 * @param {*} text 
 * @param {*} quoted 
 * @param {*} options 
 * @returns 
 */
bot.sendText = (jid, text, quoted = '', options) => bot.sendMessage(jid, { text: text, ...options }, { quoted })
/**
 * 
 * @param {*} message 
 * @param {*} filename 
 * @param {*} attachExtension 
 * @returns 
 */
bot.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
let quoted = message.msg ? message.msg : message
let mime = (message.msg || message).mimetype || ''
let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
const stream = await downloadContentFromMessage(quoted, messageType)
let buffer = Buffer.from([])
for await(const chunk of stream) {
buffer = Buffer.concat([buffer, chunk])
}
let type = await FileType.fromBuffer(buffer)
trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
await fs.writeFileSync(trueFileName, buffer)
return trueFileName
}
bot.downloadMediaMessage = async (message) => {
let mime = (message.msg || message).mimetype || ''
let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
const stream = await downloadContentFromMessage(message, messageType)
let buffer = Buffer.from([])
for await(const chunk of stream) {
buffer = Buffer.concat([buffer, chunk])
}
return buffer
 } 
/**
 * 
 * @param {*} jid 
 * @param {*} message 
 * @param {*} forceForward 
 * @param {*} options 
 * @returns 
 */
bot.copyNForward = async (jid, message, forceForward = false, options = {}) => {
let vtype
if (options.readViewOnce) {
message.message = message.message && message.message.ephemeralMessage && message.message.ephemeralMessage.message ? message.message.ephemeralMessage.message : (message.message || undefined)
vtype = Object.keys(message.message.viewOnceMessage.message)[0]
delete(message.message && message.message.ignore ? message.message.ignore : (message.message || undefined))
delete message.message.viewOnceMessage.message[vtype].viewOnce
message.message = {
...message.message.viewOnceMessage.message
}
}
let mtype = Object.keys(message.message)[0]
let content = await generateForwardMessageContent(message, forceForward)
let ctype = Object.keys(content)[0]
let context = {}
if (mtype != "conversation") context = message.message[mtype].contextInfo
content[ctype].contextInfo = {
...context,
...content[ctype].contextInfo
}
const waMessage = await generateWAMessageFromContent(jid, content, options ? {
...content[ctype],
...options,
...(options.contextInfo ? {
contextInfo: {
...content[ctype].contextInfo,
...options.contextInfo
}
} : {})
} : {})
await bot.relayMessage(jid, waMessage.message, { messageId:  waMessage.key.id })
return waMessage
}
bot.cMod = (jid, copy, text = '', sender = bot.user.id, options = {}) => {
//let copy = message.toJSON()
let mtype = Object.keys(copy.message)[0]
let isEphemeral = mtype === 'ephemeralMessage'
if (isEphemeral) {
mtype = Object.keys(copy.message.ephemeralMessage.message)[0]
}
let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message
let content = msg[mtype]
if (typeof content === 'string') msg[mtype] = text || content
else if (content.caption) content.caption = text || content.caption
else if (content.text) content.text = text || content.text
if (typeof content !== 'string') msg[mtype] = {
...content,
...options
}
if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid
else if (copy.key.remoteJid.includes('@broadcast')) sender = sender || copy.key.remoteJid
copy.key.remoteJid = jid
copy.key.fromMe = sender === bot.user.id
return proto.WebMessageInfo.fromObject(copy)
}
return bot
}
startbot()
let file = require.resolve(__filename)
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(chalk.redBright(`Update ${__filename}`))
delete require.cache[file]
require(file)
})
