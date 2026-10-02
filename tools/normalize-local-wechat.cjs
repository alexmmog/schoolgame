const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'project/build/wechatgame');
const configFile = path.join(output, 'project.config.json');
const original = fs.readFileSync(configFile, 'utf8');
const config = JSON.parse(original);
fs.writeFileSync(path.join(root, 'evidence/wechat-project-config.generated.json'), original);
const generatedAppId = config.appid;
config.appid = '';
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'LOCAL_ONLY.txt'),
  'LOCAL BUILD ONLY. No real AppID or ad unit has been provided.\n' +
  'Creator substituted its documented default test AppID during compilation.\n' +
  'That value was removed from this deliverable. Do not upload or claim device/account validation.\n' +
  'Use a user-owned and authorized AppID before account-bound import or real-device work.\n');
const note = { generatedAppId, deliveredAppId: '', localOnly: true, accountOrDeviceValidated: false };
fs.writeFileSync(path.join(root, 'evidence/wechat-appid-normalization.json'), JSON.stringify(note, null, 2) + '\n');
console.log(JSON.stringify(note));
