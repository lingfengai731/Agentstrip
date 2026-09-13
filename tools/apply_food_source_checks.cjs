// Emits a patch; never writes the dataset. Apply only after reviewing field-level evidence.
const fs=require('node:fs');
const file='wandermind-studio/frontend/assets/data/bali-food.json';
const original=fs.readFileSync(file,'utf8');
const data=JSON.parse(original);
const audit=require('../research/bali-food-official-checks-20260913.json');
let updated=original;
const hunks=[];
for(const check of audit.checks){
  const item=data.restaurants.find(value=>value.id===check.id);
  if(!item) throw new Error('Unknown restaurant '+check.id);
  const previous=JSON.stringify(item,null,2).split('\n').map(line=>'    '+line).join('\n');
  const changed=JSON.parse(JSON.stringify(item));
  const source={url:check.url,kind:'official',accessedAt:audit.checkedAt,verifiedFields:audit.commonCheckedFields};
  changed.source=[source].concat(changed.source.filter(value=>value.url!==check.url));
  changed.lastVerified=audit.checkedAt;
  changed.verificationStatus='official_identity_checked';
  changed.officialCuisineStatement=check.cuisineStatement;
  changed.verificationNotes=check.uncertain || 'Official listing checked; live availability, prices, coordinates, dietary requirements and opening hours need confirmation.';
  const replacement=JSON.stringify(changed,null,2).split('\n').map(line=>'    '+line).join('\n');
  // Preserve original line endings; do not reformat unrelated objects.
  const normalize=updated.replace(/\r\n/g,'\n');
  if(!normalize.includes(previous)) throw new Error('Unexpected object format '+check.id);
  updated=normalize.replace(previous,replacement);
  const comma=data.restaurants.indexOf(item)<data.restaurants.length-1?',':'';
  hunks.push('@@\n'+(previous+comma).split('\n').map(line=>'-'+line).join('\n')+'\n'+(replacement+comma).split('\n').map(line=>'+'+line).join('\n'));
}
console.log('*** Begin Patch\n*** Update File: '+process.cwd().replace(/\\/g,'/')+'/'+file+'\n'+hunks.join('\n')+'\n*** End Patch');
