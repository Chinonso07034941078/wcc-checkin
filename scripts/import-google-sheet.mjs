import fs from 'node:fs/promises'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/import-google-sheet.mjs "GOOGLE_SHEET_CSV_URL"')
  process.exit(1)
}

const res = await fetch(url)
if (!res.ok) throw new Error(`Could not fetch sheet: ${res.status} ${res.statusText}`)
const csv = await res.text()

function parseCSV(text) {
  const rows=[]; let row=[], cell='', quoted=false
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1]
    if(c==='"' && quoted && n==='"'){cell+='"';i++;continue}
    if(c==='"'){quoted=!quoted;continue}
    if(c===',' && !quoted){row.push(cell.trim());cell='';continue}
    if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell.trim());cell='';if(row.some(Boolean))rows.push(row);row=[];continue}
    cell+=c
  }
  if(cell||row.length){row.push(cell.trim());if(row.some(Boolean))rows.push(row)}
  return rows
}
const rows=parseCSV(csv)
const headers=rows.shift().map(x=>x.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim())
const find=(names)=>names.map(n=>headers.indexOf(n)).find(i=>i>=0) ?? -1
const reg=find(['registration number','registration no','registration','reg number','reg no'])
const name=find(['full name','name','attendee name'])
if(reg<0||name<0) throw new Error(`Sheet needs columns for registration number and name. Found: ${headers.join(', ')}`)
const members=rows.map(r=>({registrationNumber:r[reg]||'',name:r[name]||'',phone:'',email:''})).filter(x=>x.registrationNumber&&x.name)
const output=`/** Generated from the WCC 2026 registration sheet. */\nexport const members = ${JSON.stringify(members,null,2)}\n`
await fs.writeFile(new URL('../src/data/members.js',import.meta.url),output)
console.log(`Imported ${members.length} members into src/data/members.js`)
