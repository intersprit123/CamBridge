import { readFile, writeFile } from 'node:fs/promises';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let xml = await readFile(manifestPath, 'utf8');
if (!xml.includes('android.permission.CAMERA')) {
  xml = xml.replace(
    '<application',
    '    <uses-permission android:name="android.permission.CAMERA" />\n\n    <application'
  );
}
if (xml.includes('<application') && !xml.includes('android:usesCleartextTraffic=')) {
  xml = xml.replace('<application', '<application android:usesCleartextTraffic="true"');
}
await writeFile(manifestPath, xml, 'utf8');
console.log('Patched preview manifest: camera permission + cleartext LAN prototype support.');
console.log('Do not ship this preview manifest as a production release; use TLS/WSS instead.');
