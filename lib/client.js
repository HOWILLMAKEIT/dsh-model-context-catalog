// Generated from src/client/index.js; edit src/ and run npm run build.
(()=>{var CLIENT_ID="dsh-model-context-catalog";var CATALOG_SETTINGS_NAMESPACE="model-context-catalog";var MODEL_SETTINGS_NAMESPACE="\
llm-pi-ai";var LOCALE_NAMESPACE="settings.modelContextCatalog";var routeKey=(provider,model)=>`${provider}\0${model}`;var catalogEntryKey=(provider,model)=>`${provider}\
::${model}`;var validContextWindow=value=>Number.isSafeInteger(value)&&value>0;var DATABASE="dsh-model-context-catalog";var STORE="references";var KEY="models.dev";var STORAGE_TIMEOUT=5e3;function createCatalogCache(indexedDB=globalThis.
indexedDB){function open(){return new Promise((resolve,reject)=>{if(!indexedDB)return reject(new Error("CATALOG_CACHE_UN\
AVAILABLE"));let settled=false;const request=indexedDB.open(DATABASE,1);const timer=setTimeout(()=>{settled=true;reject(
new Error("CATALOG_CACHE_UNAVAILABLE"))},STORAGE_TIMEOUT);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.
contains(STORE))request.result.createObjectStore(STORE)};request.onsuccess=()=>{clearTimeout(timer);if(settled)return request.
result.close();settled=true;request.result.onversionchange=()=>request.result.close();resolve(request.result)};request.onerror=
()=>{clearTimeout(timer);settled=true;reject(request.error)}})}async function run(mode,value){const db=await open();try{
return await new Promise((resolve,reject)=>{const transaction=db.transaction(STORE,mode);const store=transaction.objectStore(
STORE);const request=mode==="readonly"?store.get(KEY):store.put(value,KEY);const timer=setTimeout(()=>transaction.abort(),
STORAGE_TIMEOUT);transaction.oncomplete=()=>{clearTimeout(timer);resolve(request.result)};transaction.onabort=transaction.
onerror=()=>{clearTimeout(timer);reject(transaction.error??new Error("CATALOG_CACHE_UNAVAILABLE"))}})}finally{db.close()}}
return{read:()=>run("readonly"),write:value=>run("readwrite",value)}}var compact=value=>String(value??"").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g,"");var undecorated=value=>String(
value??"").normalize("NFKC").toLowerCase().trim().replace(/\s*\((?:agent plan|coding plan|coding|plan)\)\s*$/i,"");var baseName=value=>{
let text2=undecorated(value),previous;do{previous=text2;text2=text2.replace(/[-_ ](?:20\d{2}[-_]\d{2}[-_]\d{2}|20\d{6}|(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))$/,
"").replace(/[-_ ](?:latest|preview)$/,"");const deploymentVersion=/^(.*)[-_ ]v\d+$/.exec(text2);if(deploymentVersion&&/\d/.
test(deploymentVersion[1]))text2=deploymentVersion[1]}while(text2!==previous);return text2};var variants=value=>{const text2=undecorated(
value);return[...new Set([text2,text2.split("/").at(-1)].filter(Boolean))]};function normalizeCapacitySources(modelsDev,modelMetadata={}){const records=[];const manufacturerNames={minimax:"MiniMax",
openai:"OpenAI",anthropic:"Anthropic",google:"Google",deepseek:"DeepSeek",alibaba:"Alibaba",zhipuai:"Zhipu AI",moonshotai:"\
Moonshot AI",xai:"xAI",mistral:"Mistral"};const modelIds=Object.keys(modelMetadata);const manufacturerFor=id=>{const manufacturer=id?.
split("/")[0];return manufacturer?{manufacturer,manufacturerName:manufacturerNames[manufacturer]||manufacturer}:{}};const aliases=new Map;
for(const[provider,profile]of Object.entries(modelsDev??{})){for(const[id,model]of Object.entries(profile?.models??{})){
if(!id||!model||!validContextWindow(model.limit?.context)||!model.modalities?.output?.includes("text"))continue;const inferred=modelIds.
filter(key=>compact(key.split("/").at(-1))===compact(id.split("/").at(-1)));const canonicalId=model.canonical_model_id||
(inferred.length===1?inferred[0]:void 0);if(canonicalId&&Object.hasOwn(modelMetadata,canonicalId)){if(!aliases.has(canonicalId))
aliases.set(canonicalId,new Set);aliases.get(canonicalId).add(id)}records.push({provider,providerName:profile.name||provider,
scope:"provider",...manufacturerFor(canonicalId),...canonicalId?{canonicalId}:{},id,name:model.name||id,contextWindow:model.
limit.context,kind:"context",source:"models.dev",field:"limit.context",sourceUrl:`https://models.dev/providers/${encodeURIComponent(
provider)}`})}}for(const[id,model]of Object.entries(modelMetadata)){if(!model||!validContextWindow(model.limit?.context)||
!model.modalities?.output?.includes("text"))continue;const factory=manufacturerFor(id);records.push({...factory,provider:factory.
manufacturer,providerName:factory.manufacturerName,scope:"model",id,canonicalId:id,name:model.name||id,aliases:[...aliases.
get(id)??[]].sort(),contextWindow:model.limit.context,kind:"context",source:"models.dev",field:"limit.context",sourceUrl:`\
https://models.dev/models/${id.split("/").map(encodeURIComponent).join("/")}`})}return records.sort((a,b)=>`${a.scope}/${a.
provider}/${a.id}`.localeCompare(`${b.scope}/${b.provider}/${b.id}`,"en"))}var CATALOG_URL="https://models.dev/catalog.json";var CATALOG_CACHE_TTL=24*60*60*1e3;var CATALOG_CACHE_VERSION=1;var MAX_CATALOG_BYTES=16*
1024*1024;var object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);var text=value=>typeof value===
"string"&&value.length>0;function catalogSnapshot(payload,fetchedAt){if(!object(payload)||!object(payload.providers)||!object(
payload.models))throw new Error("CAPACITY_CATALOG_INVALID");const records=normalizeCapacitySources(payload.providers,payload.
models);const snapshot={version:CATALOG_CACHE_VERSION,fetchedAt,records};if(!validCatalogSnapshot(snapshot,fetchedAt))throw new Error(
"CAPACITY_CATALOG_INVALID");return snapshot}function validCatalogSnapshot(snapshot,now){return object(snapshot)&&snapshot.
version===CATALOG_CACHE_VERSION&&Number.isSafeInteger(snapshot.fetchedAt)&&snapshot.fetchedAt>=0&&snapshot.fetchedAt<=now&&
Array.isArray(snapshot.records)&&snapshot.records.some(record=>record?.scope==="model")&&snapshot.records.some(record=>record?.
scope==="provider")&&snapshot.records.every(record=>object(record)&&text(record.id)&&text(record.name)&&text(record.provider)&&
text(record.providerName)&&["model","provider"].includes(record.scope)&&record.source==="models.dev"&&record.kind==="con\
text"&&record.field==="limit.context"&&validContextWindow(record.contextWindow)&&typeof record.sourceUrl==="string"&&record.
sourceUrl.startsWith("https://models.dev/")&&(record.canonicalId===void 0||text(record.canonicalId))&&(record.aliases===
void 0||Array.isArray(record.aliases)&&record.aliases.every(text)))}async function downloadCatalog(fetcher,signal,now){const response=await fetcher(
CATALOG_URL,{method:"GET",credentials:"omit",referrerPolicy:"no-referrer",cache:"no-store",mode:"cors",signal});if(!response.
ok)throw new Error("CAPACITY_CATALOG_UNAVAILABLE");if(Number(response.headers?.get("content-length"))>MAX_CATALOG_BYTES)
throw new Error("CAPACITY_CATALOG_INVALID");const body=await response.text();if(body.length>MAX_CATALOG_BYTES)throw new Error(
"CAPACITY_CATALOG_INVALID");return catalogSnapshot(JSON.parse(body),now())}function catalogInfo(snapshot){return{updatedAt:new Date(
snapshot.fetchedAt).toISOString(),records:snapshot.records.length,modelRecords:snapshot.records.filter(record=>record.scope===
"model").length,sources:[{name:"models.dev",url:CATALOG_URL}]}}function createCatalogLoader({fetcher=(...args)=>globalThis.fetch(...args),cache=createCatalogCache(),now=Date.now,timeoutMs=3e4}={}){
let memory;let pending;const fresh=snapshot=>validCatalogSnapshot(snapshot,now())&&now()-snapshot.fetchedAt<CATALOG_CACHE_TTL;
const result=(snapshot,status)=>({records:snapshot.records,info:catalogInfo(snapshot),status});async function readAndRefresh(){
if(fresh(memory))return result(memory,"cached");let previous=validCatalogSnapshot(memory,now())?memory:void 0;try{const stored=await cache.
read();if(validCatalogSnapshot(stored,now())&&(!previous||stored.fetchedAt>previous.fetchedAt))previous=stored}catch{}if(fresh(
previous)){memory=previous;return result(previous,"cached")}const controller=new AbortController;let timer;try{const snapshot=await Promise.
race([downloadCatalog(fetcher,controller.signal,now),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(
new Error("CAPACITY_CATALOG_UNAVAILABLE"))},timeoutMs)})]);clearTimeout(timer);memory=snapshot;try{await cache.write(snapshot)}catch{}
return result(snapshot,"downloaded")}catch{if(!previous)throw new Error("CAPACITY_CATALOG_UNAVAILABLE");memory=previous;
return result(previous,"stale")}finally{clearTimeout(timer)}}return{load(){if(!pending)pending=readAndRefresh().finally(
()=>pending=void 0);return pending}}}var dictionaries={zh:{nav:"上下文窗口",title:"模型上下文窗口",subtitle:"匹配并管理已配置模型的上下文窗口，支持批量添加和手动修改。",
autoAdd:"一键匹配",autoTitle:"选择要管理的模型",autoHint:"默认保留已有窗口；需要改值时，先选择参考容量。勾选后点击“添加并启用”。",
referenceSummary:"models.dev · {count} 个模型 · 获取于 {date}",references_downloaded:"已获取最新资料",references_cached:"\
使用 24 小时内缓存",references_stale:"更新失败，使用上次资料",referencesUnavailable:"暂时无法获取容量资料，请重试；仍可\
手动添加。",manufacturer:"模型厂家：{name}",unknownManufacturer:"资料未注明",modelDefault:"模型默认值",
fromModelDefault:"容量来源：模型默认值",fromProvider:"容量来源：{name}",fromCurrent_model:"容量来源：当前模型配置",
fromCurrent_native:"容量来源：DSH 内置目录",fromCurrent_provider:"容量来源：服务商默认配置",keepCurrent:"\
保留当前窗口",existingOnly:"使用现有配置",selectionSummary:"已选 {selected} / {total} 个模型",select:"选\
择",selectAll:"全选",selectNone:"取消全选",selectRoute:"添加 {route}",chooseCapacity:"选择 {route} 的参考容量",
currentWindow:"当前窗口",referenceWindow:"管理窗口与来源",notDeclared:"未声明",differentWindow:"与参考值不同，默认保\
留",sameWindow:"与参考容量一致",configuredWindow:"已有窗口，可纳入管理",missingWindow:"缺少模型级声明",
match_exact:"名称匹配",match_version:"日期 / 版本后缀匹配，待确认",match_name:"显示名称匹配，待确认",
match_fuzzy:"模型信息匹配，待确认",unmatched:"未找到资料",resolveConflict:"资料有不同容量，请选择",
chooseReference:"选择参考容量",manualCapacity:"手动填写",addSelected:"添加并启用 {count} 个模型",scanning:"\
匹配中…",noCandidates:"没有可添加的模型。请先配置模型，或编辑已有管理条目。",addedSummary:"\
已添加并启用 {count} 个模型。",candidatesChanged:"模型或目录已变更，请重新匹配后再添加。",nativeUnavailable:"\
暂时无法核对 DSH 内置窗口，请重试；仍可手动添加。",summary:"已启用 {active} 项 · 已配置模型 {configured} 个",
add:"添加模型",addTitle:"添加上下文窗口",editTitle:"编辑上下文窗口",chooseModel:"已配置模型",selectPlaceholder:"\
选择模型",searchModels:"搜索服务商、模型…",noMatches:"没有匹配的模型",window:"上下文窗口",sourceUrl:"\
容量来源链接（可选）",note:"备注（可选）",notePlaceholder:"记录该部署的容量依据",save:"保存",
saving:"保存中…",cancel:"取消",close:"收起",edit:"编辑",enable:"启用",manageRoute:"启用 {route} 的窗口管理",
remove:"删除",syncPending:"模型配置尚未同步，请稍后查看；持续未同步时请检查 DSH 日志。",routeMissing:"\
DSH 中已找不到这个模型，请重新添加模型或删除此条目。",empty:"点击“一键匹配”添加模型；已有上下文窗口也可纳入管理。",
noConfiguredModels:"请先在 DSH 模型设置中添加模型。",catalogUnavailable:"窗口设置暂不可用，请稍后重试。",
piUnavailable:"已配置模型列表暂不可用。",readOnly:"当前为只读视图，无法保存更改。",invalid:"请\
选择模型，并填写大于 0 的整数上下文窗口。",writeRefused:"配置已变更或当前无法写入，请核对最新内容后重试。"},
en:{nav:"Context windows",title:"Model context windows",subtitle:"Match and manage context windows for configured models\
. Add in bulk or edit manually.",autoAdd:"Match models",autoTitle:"Choose models to manage",autoHint:"Existing windows a\
re kept by default. To change a value, choose a reference capacity first. Select models, then click “Add and enable”.",
referenceSummary:"models.dev · {count} models · retrieved {date}",references_downloaded:"Latest references fetched",references_cached:"\
Using cache from the last 24 hours",references_stale:"Refresh failed; using previous references",referencesUnavailable:"\
Cannot fetch capacity references right now. Retry, or add a model manually.",manufacturer:"Manufacturer: {name}",unknownManufacturer:"\
Not specified",modelDefault:"model default",fromModelDefault:"Capacity from: model default",fromProvider:"Capacity from:\
 {name}",fromCurrent_model:"Capacity from: current model configuration",fromCurrent_native:"Capacity from: DSH built-in \
catalog",fromCurrent_provider:"Capacity from: provider default configuration",keepCurrent:"Keep current window",existingOnly:"\
Use existing configuration",selectionSummary:"{selected} / {total} models selected",select:"Select",selectAll:"Select al\
l",selectNone:"Clear selection",selectRoute:"Add {route}",chooseCapacity:"Choose reference capacity for {route}",currentWindow:"\
Current window",referenceWindow:"Managed window and source",notDeclared:"Not declared",differentWindow:"Different refere\
nce value; keep current by default",sameWindow:"Matches the reference capacity",configuredWindow:"Existing window; avail\
able to manage",missingWindow:"No model-level declaration",match_exact:"Name match",match_version:"Date / version suffix\
 match; review",match_name:"Display name match; review",match_fuzzy:"Model identity match; review",unmatched:"No referen\
ce found",resolveConflict:"Conflicting capacities; choose one",chooseReference:"Choose a reference capacity",manualCapacity:"\
Enter manually",addSelected:"Add and enable {count} models",scanning:"Matching…",noCandidates:"No models to add. Confi\
gure a model first, or edit an existing managed entry.",addedSummary:"Added and enabled {count} models.",candidatesChanged:"\
Models or entries changed. Match again before adding.",nativeUnavailable:"Cannot check DSH built-in windows right now. R\
etry, or add a model manually.",summary:"{active} enabled · {configured} configured models",add:"Add model",addTitle:"A\
dd context window",editTitle:"Edit context window",chooseModel:"Configured model",selectPlaceholder:"Choose a model",searchModels:"\
Search providers, models…",noMatches:"No matching models",window:"Context window",sourceUrl:"Capacity source URL (opti\
onal)",note:"Note (optional)",notePlaceholder:"Record the basis for this deployment limit",save:"Save",saving:"Saving…",
cancel:"Cancel",close:"Collapse",edit:"Edit",enable:"Enable",manageRoute:"Enable context window management for {route}",
remove:"Delete",syncPending:"The model configuration has not synced yet. If this persists, check the DSH logs.",routeMissing:"\
This model is no longer configured in DSH. Add it again or delete this entry.",empty:"Choose “Match models” to add model\
s, including those with existing context windows.",noConfiguredModels:"Add a model in DSH model settings first.",catalogUnavailable:"\
Context window settings are unavailable right now.",piUnavailable:"The configured model list is unavailable right now.",
readOnly:"Read-only view; changes cannot be saved.",invalid:"Choose a model and enter a positive integer context window.",
writeRefused:"The configuration changed or is read-only. Review the latest values and retry."}};var styles_default=".mcc-page {\n  max-width: 900px;\n  padding: 8px 4px 48px;\n  color: var(--dsw-alias-label-primary);\n}\n\
.mcc-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 20px;\n  margin-bottom: \
18px;\n}\n.mcc-heading {\n  min-width: 0;\n  max-width: 680px;\n}\n.mcc-head > .mcc-toolbar {\n  flex: none;\n  flex-wrap: nowra\
p;\n}\n.mcc-title {\n  font-size: 21px;\n  line-height: 30px;\n  font-weight: 650;\n  margin: 0 0 5px;\n}\n.mcc-sub {\n  font-siz\
e: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 0;\n}\n.mcc-count {\n  margin-top: 10px;\n\
  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n.mcc-card {\n  border: 1px solid var(--dsw-alias-border-l\
2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 13px;\n  margin-bottom: 10px;\n  overflow: hidden;\n  trans\
ition:\n    border-color 0.16s ease,\n    box-shadow 0.16s ease;\n}\n.mcc-card.open {\n  border-color: var(--dsw-static-deeps\
eek-500, #4d6bfe);\n  box-shadow: 0 0 0 2px rgba(77, 107, 254, 0.08);\n  overflow: visible;\n}\n.mcc-row {\n  display: flex;\n\
  gap: 14px;\n  align-items: center;\n  padding: 14px 16px;\n}\n.mcc-main {\n  min-width: 0;\n  flex: 1;\n}\n.mcc-route {\n  font\
-size: 14px;\n  line-height: 21px;\n  font-weight: 620;\n  overflow-wrap: anywhere;\n}\n.mcc-meta {\n  margin-top: 5px;\n  font\
-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex-wrap: \
wrap;\n}\n.mcc-toggle {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  margin-left: 6px;\n  color: var(--dsw-\
alias-label-secondary);\n  font-size: 12px;\n  cursor: pointer;\n}\n.mcc-switch {\n  appearance: none;\n  flex: none;\n  width:\
 32px;\n  height: 20px;\n  padding: 2px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--dsw-alias-border-l3, #b9\
bdc7);\n  cursor: pointer;\n  transition: background 0.16s ease;\n}\n.mcc-switch[aria-checked='true'] {\n  background: var(--\
dsw-static-deepseek-500, #4d6bfe);\n}\n.mcc-switch-thumb {\n  display: block;\n  width: 16px;\n  height: 16px;\n  border-radiu\
s: 50%;\n  background: #fff;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);\n  transition: transform 0.16s ease;\n}\n.mcc-swit\
ch[aria-checked='true'] .mcc-switch-thumb {\n  transform: translateX(12px);\n}\n.mcc-switch:disabled {\n  opacity: 0.48;\n  c\
ursor: not-allowed;\n}\n.mcc-sync-notice {\n  margin-top: 8px;\n  font-size: 12px;\n  line-height: 19px;\n  color: #a55b00;\n}\n\
.mcc-card.off .mcc-route,\n.mcc-card.off .mcc-meta {\n  color: var(--dsw-alias-label-tertiary);\n}\n.mcc-actions {\n  display\
: flex;\n  gap: 6px;\n  flex: none;\n}\n.mcc-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  bac\
kground: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  border-radius: 8px;\n  min-height: 34px;\
\n  padding: 6px 11px;\n  font: inherit;\n  font-size: 12px;\n  line-height: 18px;\n  cursor: pointer;\n  white-space: nowrap;\
\n}\n.mcc-btn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n.mcc-btn.primary {\n  background: var(--dsw-st\
atic-deepseek-500, #4d6bfe);\n  color: #fff;\n  border-color: transparent;\n  font-weight: 600;\n}\n.mcc-btn.primary:hover {\n\
  filter: brightness(0.96);\n}\n.mcc-btn.danger {\n  color: #c44343;\n}\n.mcc-btn:disabled {\n  opacity: 0.48;\n  cursor: not-a\
llowed;\n}\n.mcc-editor {\n  border-top: 1px solid var(--dsw-alias-border-l1);\n  background: var(--dsw-alias-bg-layer-2);\n \
 padding: 16px;\n}\n.mcc-new {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 13px;\n  margin: 0 0 14px;\n\
  overflow: hidden;\n}\n.mcc-new:has(.mcc-combo-trigger.open) {\n  overflow: visible;\n}\n.mcc-editor-title {\n  font-size: 13\
px;\n  font-weight: 620;\n  margin: 0 0 13px;\n}\n.mcc-form {\n  display: grid;\n  grid-template-columns: minmax(220px, 1.2fr)\
 minmax(160px, 0.8fr);\n  gap: 12px;\n}\n.mcc-field {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.mcc-field.f\
ull {\n  grid-column: 1/-1;\n}\n.mcc-label {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n.mcc-input {\n \
 box-sizing: border-box;\n  width: 100%;\n  height: 38px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: va\
r(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n  border-radius: 8px;\n  padding: 0 10px;\n  font: inh\
erit;\n  font-size: 13px;\n  outline: none;\n}\n.mcc-input:focus {\n  border-color: var(--dsw-static-deepseek-500, #4d6bfe);\n\
  box-shadow: 0 0 0 2px rgba(77, 107, 254, 0.08);\n}\nselect.mcc-input {\n  cursor: pointer;\n}\n.mcc-textarea {\n  height: 68\
px;\n  padding: 9px 10px;\n  resize: vertical;\n  line-height: 20px;\n}\n.mcc-form-actions {\n  grid-column: 1/-1;\n  display: \
flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 2px;\n}\n.mcc-error {\n  grid-column: 1/-1;\n  color: #c44343;\n\
  font-size: 12px;\n}\n.mcc-empty {\n  padding: 34px;\n  text-align: center;\n  border: 1px dashed var(--dsw-alias-border-l2)\
;\n  border-radius: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n.mcc-hint {\n  font-size: 12px;\n  line-height: 19px;\
\n  color: var(--dsw-alias-label-tertiary);\n}\n.mcc-combo {\n  position: relative;\n}\n.mcc-combo-trigger {\n  width: 100%;\n  \
min-height: 40px;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  text-align: left;\n  border: 1px solid var(--dsw-\
alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n  border-radius: 8\
px;\n  padding: 0 10px;\n  font: inherit;\n  cursor: pointer;\n}\n.mcc-combo-trigger:hover,\n.mcc-combo-trigger.open {\n  borde\
r-color: var(--dsw-alias-border-l3);\n}\n.mcc-combo-trigger:disabled {\n  opacity: 0.65;\n  cursor: not-allowed;\n}\n.mcc-comb\
o-value {\n  min-width: 0;\n  flex: 1;\n}\n.mcc-combo-primary {\n  display: block;\n  font-size: 13px;\n  line-height: 20px;\n  \
font-weight: 500;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.mcc-combo-chevron {\n  flex: n\
one;\n  width: 7px;\n  height: 7px;\n  border-right: 1.5px solid currentColor;\n  border-bottom: 1.5px solid currentColor;\n \
 transform: rotate(45deg) translateY(-2px);\n  color: var(--dsw-alias-label-tertiary);\n}\n.mcc-combo-trigger.open .mcc-com\
bo-chevron {\n  transform: rotate(225deg) translate(-2px, -1px);\n}\n.mcc-combo-menu {\n  position: fixed;\n  z-index: 1000;\n\
  max-width: calc(100vw - 16px);\n  border: 1px solid var(--dsw-alias-border-l1);\n  background: var(--dsw-alias-bg-layer-\
1, #fff);\n  border-radius: 10px;\n  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);\n  overflow: hidden;\n}\n.mcc-combo-search-\
wrap {\n  padding: 6px 6px 3px;\n}\n.mcc-combo-search {\n  width: 100%;\n  height: 32px;\n  box-sizing: border-box;\n  border: \
1px solid transparent;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  border-radi\
us: 7px;\n  padding: 0 9px;\n  font: inherit;\n  font-size: 12px;\n  outline: none;\n}\n.mcc-combo-search:hover {\n  border-col\
or: var(--dsw-alias-border-l2);\n}\n.mcc-combo-search:focus {\n  border-color: var(--dsw-alias-border-l3);\n  background: va\
r(--dsw-alias-bg-layer-1);\n}\n.mcc-combo-list {\n  max-height: var(--mcc-menu-list-max, 370px);\n  overflow: auto;\n  paddin\
g: 3px 5px 5px;\n  scrollbar-width: thin;\n  scrollbar-color: var(--dsw-alias-border-l3) transparent;\n}\n.mcc-combo-list::-\
webkit-scrollbar {\n  width: 6px;\n}\n.mcc-combo-list::-webkit-scrollbar-track {\n  background: transparent;\n}\n.mcc-combo-li\
st::-webkit-scrollbar-thumb {\n  background: var(--dsw-alias-border-l3);\n  border-radius: 999px;\n}\n.mcc-combo-group + .mc\
c-combo-group {\n  margin-top: 4px;\n  padding-top: 3px;\n}\n.mcc-combo-group-head {\n  position: sticky;\n  top: 0;\n  z-index\
: 1;\n  display: flex;\n  align-items: baseline;\n  gap: 6px;\n  padding: 8px 8px 4px;\n  background: var(--dsw-alias-bg-laye\
r-1, #fff);\n  color: var(--dsw-alias-label-tertiary);\n}\n.mcc-combo-group-title {\n  font-size: 11px;\n  line-height: 15px;\
\n  font-weight: 500;\n}\n.mcc-combo-group-sub {\n  min-width: 0;\n  font-size: 10px;\n  line-height: 14px;\n  white-space: now\
rap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.mcc-combo-option {\n  width: 100%;\n  min-height: 34px;\n  display: \
flex;\n  align-items: center;\n  border: 0;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  border-r\
adius: 8px;\n  padding: 7px 9px;\n  text-align: left;\n  font: inherit;\n  cursor: pointer;\n}\n.mcc-combo-option:hover,\n.mcc-\
combo-option.active,\n.mcc-combo-option.selected {\n  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06\
));\n}\n.mcc-combo-option.selected .mcc-combo-primary {\n  font-weight: 540;\n}\n.mcc-combo-empty {\n  padding: 18px 12px;\n  t\
ext-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n}\n.mcc-notice {\n  display: flex;\n  align\
-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-left: 3px solid var(--dsw-static-de\
epseek-500, #4d6bfe);\n  background: var(--dsw-alias-bg-layer-2);\n  border-radius: 10px;\n  padding: 10px 12px;\n  margin: \
0 0 12px;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n.mcc-toolbar {\n  display:\
 flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n.mcc-batch {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 13\
px;\n  overflow: hidden;\n  margin-bottom: 20px;\n}\n.mcc-batch-head {\n  padding: 16px;\n  background: var(--dsw-alias-bg-lay\
er-2);\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\n}\n.mcc-batch-title {\n  font-size: 15px;\n  font-weight: 620\
;\n  margin: 0 0 6px;\n}\n.mcc-batch-tools {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  ga\
p: 12px;\n  margin-top: 12px;\n}\n.mcc-batch-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12px;\n}\n.mcc-\
batch-table th {\n  text-align: left;\n  padding: 10px 12px;\n  color: var(--dsw-alias-label-tertiary);\n  font-weight: 500;\
\n  background: var(--dsw-alias-bg-layer-2);\n}\n.mcc-batch-table td {\n  padding: 12px;\n  border-top: 1px solid var(--dsw-a\
lias-border-l1);\n  vertical-align: top;\n}\n.mcc-batch-table th:first-child,\n.mcc-batch-table td:first-child {\n  width: 26\
px;\n}\n.mcc-batch-table th:last-child {\n  width: 42%;\n}\n.mcc-check {\n  width: 16px;\n  height: 16px;\n  accent-color: var(-\
-dsw-static-deepseek-500, #4d6bfe);\n  cursor: pointer;\n}\n.mcc-batch-route {\n  font-size: 11px;\n  color: var(--dsw-alias-\
label-tertiary);\n  margin-top: 3px;\n  overflow-wrap: anywhere;\n}\n.mcc-batch-evidence {\n  font-size: 11px;\n  line-height:\
 18px;\n  color: var(--dsw-alias-label-secondary);\n  margin-top: 5px;\n  overflow-wrap: anywhere;\n}\n.mcc-batch-evidence a \
{\n  color: var(--dsw-static-deepseek-500, #4d6bfe);\n}\n.mcc-batch-footer {\n  padding: 12px 16px;\n  display: flex;\n  justi\
fy-content: flex-end;\n  gap: 8px;\n  border-top: 1px solid var(--dsw-alias-border-l1);\n}\n.mcc-batch-scroll {\n  overflow-x\
: auto;\n}\n.mcc-batch-method {\n  font-size: 11px;\n  color: var(--dsw-alias-label-tertiary);\n  margin-top: 4px;\n}\n.mcc-btn\
:focus-visible,\n.mcc-switch:focus-visible,\n.mcc-combo-trigger:focus-visible,\n.mcc-input:focus-visible {\n  outline: 2px s\
olid var(--dsw-static-deepseek-500, #4d6bfe);\n  outline-offset: 1px;\n}\n.mcc-combo-search:focus-visible {\n  outline: none\
;\n  box-shadow: 0 0 0 1px var(--dsw-alias-border-l2);\n}\n@media (max-width: 680px) {\n  .mcc-head {\n    align-items: stret\
ch;\n    flex-direction: column;\n  }\n  .mcc-head > .mcc-btn {\n    align-self: flex-start;\n  }\n  .mcc-form {\n    grid-temp\
late-columns: 1fr;\n  }\n  .mcc-field.full,\n  .mcc-form-actions,\n  .mcc-error {\n    grid-column: 1;\n  }\n  .mcc-row {\n    a\
lign-items: flex-start;\n    flex-direction: column;\n  }\n  .mcc-actions {\n    width: 100%;\n    justify-content: flex-end;\
\n    flex-wrap: wrap;\n  }\n}\n";function installStyles(){const node=document.createElement("style");node.dataset.plugin="dsh-model-context-catalog";node.
textContent=styles_default;document.head.append(node);return()=>node.remove()}function actualContext(pi,provider,model){const profile=pi?.providers?.[provider];const row=Array.isArray(profile?.models)?
profile.models.find(item=>item?.id===model):void 0;if(!row)return void 0;if(typeof row.contextWindow==="number"&&Number.
isFinite(row.contextWindow))return{value:row.contextWindow,explicit:true};if(typeof profile.defaultContextWindow==="numb\
er"&&Number.isFinite(profile.defaultContextWindow))return{value:profile.defaultContextWindow,explicit:false};return{value:void 0,
explicit:false}}function formatTokens(value){return new Intl.NumberFormat().format(value)}function filterOptions(options,query){
const normalized=query.trim().toLocaleLowerCase();if(normalized==="")return options;return options.filter(option=>option.
searchText.includes(normalized))}function groupModelsByProvider(options){const groups=new Map;for(const option of options){
let group=groups.get(option.provider);if(!group){group={provider:option.provider,title:option.providerName,options:[]};groups.
set(option.provider,group)}group.options.push(option)}return[...groups.values()].sort((a,b)=>a.title.localeCompare(b.title)||
a.provider.localeCompare(b.provider))}function floatingMenuLayout(rect,viewportWidth,viewportHeight){const margin=8;const gap=5;
const width=Math.min(Math.max(rect.width,240),Math.max(viewportWidth-margin*2,0));const left=Math.min(Math.max(rect.left,
margin),Math.max(viewportWidth-width-margin,margin));const below=viewportHeight-rect.bottom-gap-margin;const above=rect.
top-gap-margin;const opensAbove=below<260&&above>below;const available=Math.max(opensAbove?above:below,160);const menuHeight=Math.
min(420,available);const top=opensAbove?Math.max(margin,rect.top-gap-menuHeight):rect.bottom+gap;return{position:"fixed",
left:`${Math.round(left)}px`,top:`${Math.round(top)}px`,width:`${Math.round(width)}px`,"--mcc-menu-list-max":`${Math.max(
Math.floor(menuHeight-43),117)}px`}}var faithfulModelName=model=>typeof model.name==="string"&&model.name.length>0?model.
name:model.id;function configuredModels(pi){const result=[];for(const[provider,profile]of Object.entries(pi?.providers??
{})){if(!profile||typeof profile!=="object"||!Array.isArray(profile.models))continue;const providerName=typeof profile.displayName===
"string"&&profile.displayName.length>0?profile.displayName:provider;for(const model of profile.models){if(!model||typeof model.
id!=="string")continue;const modelName=faithfulModelName(model);result.push({value:routeKey(provider,model.id),provider,
providerName,model:model.id,modelName,searchText:`${provider} ${providerName} ${model.id} ${modelName}`.toLocaleLowerCase()})}}
return result.sort((a,b)=>`${a.providerName}\0${a.modelName}`.localeCompare(`${b.providerName}\0${b.modelName}`))}async function loadNativeContexts(providers,discover){if(typeof discover!=="function")throw new Error("NATIVE_CATALOG_UN\
AVAILABLE");const contexts=Object.create(null);for(let offset=0;offset<providers.length;offset+=4){await Promise.all(providers.
slice(offset,offset+4).map(async provider=>{const response=await discover(provider);if(!response.ok){if(response.error?.
code!=="llm/model-discovery-rejected")throw new Error("NATIVE_CATALOG_UNAVAILABLE");contexts[provider]={};return}contexts[provider]=
Object.fromEntries(response.value.filter(row=>typeof row.id==="string"&&Number.isSafeInteger(row.contextWindow)&&row.contextWindow>
0).map(row=>[row.id,row.contextWindow]))}))}return contexts}var PROVIDER_ALIASES=new Map(["ark-agent-plan-cn","ark-agent-plan","ark-coding-plan-cn","ark-coding-plan"].map(alias=>[compact(
alias),compact("volcengine-coding-plan")]));function providerEntries(indexed,provider,providerName){const keys=[provider,
providerName].map(compact).filter(Boolean);const aliases=keys.map(key=>PROVIDER_ALIASES.get(key)).filter(Boolean);const records=indexed.
filter(({record})=>record.scope==="provider");const direct=records.filter(({record})=>keys.includes(compact(record.provider)));
const aliased=records.filter(({record})=>aliases.includes(compact(record.provider)));const named=records.filter(({record})=>keys.
includes(compact(record.providerName)));return direct.length?direct:aliased.length?aliased:named}var families=new Set(["gpt","glm","claude","gemini","deepseek","minimax","kimi","qwen","llama","grok","mistral","jamba",
"command","nova","phi","gemma","v"]);var routeWords=new Set(["cdx","proxy","gateway","router","api","official","custom",
"agent","plan","cn"]);var variantWord=/^(?:flash|mini|nano|thinking|reasoning|codex|pro|max|fast|lite|turbo|plus|instruct|vision|audio)/;
function identity(value){const text2=baseName(variants(value).at(-1));const tokens=text2.match(/[a-z]+|\d+/g)??[];return{
key:compact(text2),words:new Set(tokens.filter(token=>!/^\d+$/.test(token))),version:tokens.filter(token=>/^\d+$/.test(token)).
join(".")}}function hasModelInformation(value){const model=identity(value);return Boolean(model.version)||[...model.words].
some(word=>!families.has(word)&&!routeWords.has(word))}function createIdentityMatcher(indexed){const identities=new Map(
indexed.map(item=>[item,identity(item.record.canonicalId||item.record.id)]));const vocabulary=new Set([...identities.values()].
flatMap(model=>[...model.words]));return(pool,query)=>{const supplied=identity(query);const words=[...supplied.words].filter(
word=>!routeWords.has(word)&&(vocabulary.has(word)||variantWord.test(word)));if(!words.length||!supplied.version&&words.
every(word=>families.has(word)))return[];const matches=pool.filter(item=>{const model=identities.get(item);if(supplied.version&&
supplied.version!==model.version)return false;if(!words.every(word=>model.words.has(word)))return false;return[...model.
words].every(word=>families.has(word)||supplied.words.has(word))});return new Set(matches.map(item=>identities.get(item).
key)).size===1?matches:[]}}function createModelMatcher(records){const indexed=records.filter(record=>record&&validContextWindow(record.contextWindow)&&
record.kind==="context"&&typeof record.id==="string").map(record=>{const names=[record.id,...record.scope==="model"?record.
aliases??[]:[]].flatMap(variants);return{record,exact:names.map(compact).filter(Boolean),base:names.map(v=>compact(baseName(
v))).filter(Boolean)}});const matchIdentity=createIdentityMatcher(indexed);function matchModel(id,name=id,provider="",providerName=provider){
const providerRecords=providerEntries(indexed,provider,providerName);const defaultRecords=indexed.filter(({record})=>record.
scope==="model");let matches=[],method="exact",referenceScope="model";for(const pool of[providerRecords,defaultRecords]){
for(const[query,fromName]of[[id,false],[name,true]]){const keys=variants(query).map(compact).filter(Boolean);matches=pool.
filter(item=>item.exact.some(key=>keys.includes(key)));if(matches.length){method=fromName?"name":"exact";break}const baseKeys=variants(
query).map(v=>compact(baseName(v))).filter(v=>v.length>=2&&hasModelInformation(v));matches=pool.filter(item=>item.base.some(
key=>baseKeys.includes(key)));if(matches.length){method=fromName?"name":"version";break}}if(matches.length){referenceScope=
matches[0].record.scope;break}}if(!matches.length){for(const pool of[providerRecords,defaultRecords]){for(const query of[
id,name]){matches=matchIdentity(pool,query);if(matches.length)break}if(matches.length){method="fuzzy";referenceScope=matches[0].
record.scope;break}}}const groups=new Map;for(const{record}of matches){const key=`${record.kind}:${record.contextWindow}`;
if(!groups.has(key))groups.set(key,{key,contextWindow:record.contextWindow,kind:record.kind,evidence:[]});groups.get(key).
evidence.push(record)}const choices=[...groups.values()].sort((a,b)=>a.contextWindow-b.contextWindow);const recommended=choices.
length===1?choices[0]:void 0;return{method,choices,recommended,conflict:choices.length>1,referenceScope}}return matchModel}function capacitySourceNote(evidence){if(evidence.scope==="configured")return"";const name=evidence.scope==="model"?evidence.
manufacturerName||evidence.manufacturer||evidence.providerName||evidence.provider:evidence.providerName||evidence.provider;
return`${name} (${evidence.source})`}function readableSourceNote(entry){const note=entry.note??"";const parts=note.split(
" · ");if(parts.length!==5||parts[0]!=="models.dev"||parts[4]!=="limit.context")return note;if(parts.some(part=>!part))
return note;let source;try{source=new URL(entry.sourceUrl)}catch{return note}if(source.protocol!=="https:"||source.hostname!==
"models.dev")return note;const isDefault=parts[2]==="Model default";if(!source.pathname.startsWith(isDefault?"/models/":
"/providers/"))return note;return capacitySourceNote({scope:isDefault?"model":"provider",manufacturerName:parts[1],providerName:parts[2],
source:parts[0]})}function managementChoices(match,currentWindow,windowSource){if(!validContextWindow(currentWindow))return match;const same=match.
choices.find(choice=>choice.contextWindow===currentWindow);const current=same??{key:`configured:${currentWindow}`,contextWindow:currentWindow,
kind:"context",evidence:[{scope:"configured",windowSource}]};return{...match,choices:same?match.choices:[current,...match.
choices],recommended:current}}function createCapacityDiscovery(records){const matchModel=createModelMatcher(records);function scanModels(pi,entries={},nativeContexts={}){
const rows=[];const managed=new Set(Object.values(entries).filter(Boolean).map(entry=>routeKey(entry.provider,entry.model)));
const seen=new Set;for(const[provider,profile]of Object.entries(pi?.providers??{})){if(!Array.isArray(profile?.models))continue;
for(const model of profile.models){if(!model||typeof model.id!=="string"||!model.id)continue;const key=routeKey(provider,
model.id);if(seen.has(key)||managed.has(key))continue;seen.add(key);const match=matchModel(model.id,model.name,provider,
profile.displayName);const inherited=nativeContexts[provider]?.[model.id];const explicit=validContextWindow(model.contextWindow);
const native=model.contextWindow==null&&validContextWindow(inherited);const currentWindow=explicit?model.contextWindow:native?
inherited:profile.defaultContextWindow;const windowSource=explicit?"model":native?"native":validContextWindow(currentWindow)?
"provider":void 0;const isSame=validContextWindow(currentWindow)&&match.choices.some(choice=>choice.contextWindow===currentWindow);
const reason=isSame?"same":explicit||native?match.choices.length?"different":"configured":"missing";rows.push({key,provider,
model:model.id,modelName:model.name||model.id,currentWindow:validContextWindow(currentWindow)?currentWindow:void 0,windowSource,
hasReference:match.choices.length>0,reason,...managementChoices(match,currentWindow,windowSource),selectedByDefault:!validContextWindow(
currentWindow)&&match.method==="exact"&&Boolean(match.recommended)})}}return rows}function planSelectedEntries(pi,entries,rows,selections,nativeContexts={}){
const fresh=new Map(scanModels(pi,entries,nativeContexts).map(row=>[row.key,row]));const next={...entries};const added=[];
for(const row of rows){const selectedKey=selections[row.key];if(!selectedKey)continue;const current=fresh.get(row.key);if(!current||
current.currentWindow!==row.currentWindow||current.windowSource!==row.windowSource||current.reason!==row.reason){throw new Error(
"STALE_CANDIDATES")}const choice=current.choices.find(item=>item.key===selectedKey);if(!choice)throw new Error("STALE_CA\
NDIDATES");const evidence=choice.evidence[0];const key=catalogEntryKey(row.provider,row.model);if(Object.hasOwn(next,key))
throw new Error("STALE_CANDIDATES");const entry={provider:row.provider,model:row.model,contextWindow:choice.contextWindow,
sourceUrl:evidence.sourceUrl??"",note:capacitySourceNote(evidence),enabled:true};next[key]=entry;added.push(entry)}return{
entries:next,added}}return{matchModel,scanModels,planSelectedEntries}}function entryMutations(previous,next){const ops=[];for(const key of Object.keys(previous)){if(!Object.hasOwn(next,key))
ops.push({op:"unset",path:["entries",key]})}for(const[key,value]of Object.entries(next)){if(JSON.stringify(previous[key])!==
JSON.stringify(value))ops.push({op:"set",path:["entries",key],value})}return ops}function createCatalogController(React){function useScope(scope){return React.useSyncExternalStore(React.useCallback(listener=>scope.
subscribe(listener),[scope]),React.useCallback(()=>scope.getSnapshot(),[scope]))}return function useCatalogController({catalogScope,
piScope,discoverBuiltin,catalogLoader,t}){const snapshot=useScope(catalogScope);const piSnapshot=useScope(piScope);const entries=snapshot.
value?.entries??{};const options=configuredModels(piSnapshot.value);const[editingKey,setEditingKey]=React.useState(null);
const[route,setRoute]=React.useState("");const[windowValue,setWindowValue]=React.useState("");const[note,setNote]=React.
useState("");const[sourceUrl,setSourceUrl]=React.useState("");const[error,setError]=React.useState("");const[saving,setSaving]=React.
useState(false);const[scanning,setScanning]=React.useState(false);const[batch,setBatch]=React.useState(null);const[message,
setMessage]=React.useState("");const closeEditor=()=>{setEditingKey(null);setRoute("");setWindowValue("");setNote("");setSourceUrl(
"");setError("")};const startAdd=candidate=>{const firstUnused=options.find(option=>!Object.values(entries).some(item=>item.
provider===option.provider&&item.model===option.model));setBatch(null);setMessage("");setEditingKey("__new__");setRoute(
candidate?.key??firstUnused?.value??options[0]?.value??"");setWindowValue("");setNote("");setSourceUrl("");setError("")};
const startAuto=async()=>{setScanning(true);setError("");setMessage("");closeEditor();setBatch(null);try{const currentPi=piScope.
getSnapshot();if(currentPi.status!=="ready")throw new Error("NATIVE_CATALOG_UNAVAILABLE");const[references,native]=await Promise.
all([catalogLoader.load(),loadNativeContexts(Object.keys(currentPi.value?.providers??{}),discoverBuiltin)]);const capacityDiscovery=createCapacityDiscovery(
references.records);const latestPi=piScope.getSnapshot();if(latestPi.revision!==currentPi.revision||latestPi.value!==currentPi.
value)throw new Error("STALE_CANDIDATES");setBatch({rows:capacityDiscovery.scanModels(latestPi.value,catalogScope.getSnapshot().
value?.entries??{},native),native,capacityDiscovery,references})}catch(cause){setError(t(cause.message==="STALE_CANDIDAT\
ES"?"candidatesChanged":cause.message==="CAPACITY_CATALOG_UNAVAILABLE"?"referencesUnavailable":"nativeUnavailable"))}finally{
setScanning(false)}};const startEdit=(key,item)=>{setEditingKey(key);setRoute(routeKey(item.provider,item.model));setWindowValue(
String(item.contextWindow));setNote(readableSourceNote(item));setSourceUrl(item.sourceUrl??"");setError("")};const commitEntries=async next=>{
setSaving(true);setError("");try{const accepted=await catalogScope.mutate(entryMutations(entries,next),snapshot.revision);
if(!accepted){setError(t("writeRefused"));return false}return true}catch(cause){setError(cause instanceof Error?cause.message:
String(cause));return false}finally{setSaving(false)}};const submit=async event=>{event.preventDefault();const existing=editingKey&&
editingKey!=="__new__"?entries[editingKey]:void 0;const selected=options.find(option=>option.value===route)??(existing&&
route===routeKey(existing.provider,existing.model)?{provider:existing.provider,model:existing.model}:void 0);const contextWindow=Number(
windowValue);if(!selected||!validContextWindow(contextWindow)){setError(t("invalid"));return}const key=catalogEntryKey(selected.
provider,selected.model);const next={...entries};if(editingKey&&editingKey!=="__new__"&&editingKey!==key)delete next[editingKey];
next[key]={provider:selected.provider,model:selected.model,contextWindow,sourceUrl:sourceUrl.trim(),note:note.trim(),enabled:existing?.
enabled!==false};if(await commitEntries(next))closeEditor()};const toggle=(key,item)=>commitEntries({...entries,[key]:{...item,
enabled:item.enabled===false}});const remove=async key=>{const next={...entries};delete next[key];if(await commitEntries(
next)&&editingKey===key)closeEditor()};const addSelected=async selections=>{setSaving(true);setError("");try{const currentPi=piScope.
getSnapshot();const currentCatalog=catalogScope.getSnapshot();if(currentPi.status!=="ready"||currentCatalog.status!=="re\
ady"||!currentCatalog.writable)throw new Error("STALE_CANDIDATES");const plan=batch.capacityDiscovery.planSelectedEntries(
currentPi.value,currentCatalog.value?.entries??{},batch.rows,selections,batch.native);if(plan.added.length===0)return;const previous=currentCatalog.
value?.entries??{};const accepted=await catalogScope.mutate(entryMutations(previous,plan.entries),currentCatalog.revision);
if(!accepted){setError(t("writeRefused"));return}setBatch(null);setMessage(t("addedSummary",{count:plan.added.length}))}catch(cause){
setError(cause.message==="STALE_CANDIDATES"?t("candidatesChanged"):cause instanceof Error?cause.message:String(cause))}finally{
setSaving(false)}};return{snapshot,piSnapshot,entries,options,editingKey,route,windowValue,note,sourceUrl,error,saving,scanning,
batch,message,setRoute,setWindowValue,setNote,setSourceUrl,closeEditor,startAdd,startAuto,startEdit,submit,toggle,remove,
addSelected,cancelBatch:()=>{setBatch(null);setError("")}}}}function createModelCombobox(React){const h=React.createElement;let comboSeq=0;function ModelCombobox({label,value,onChange,
options,disabled,t}){const[open,setOpen]=React.useState(false);const[query,setQuery]=React.useState("");const[activeIndex,
setActiveIndex]=React.useState(0);const[menuStyle,setMenuStyle]=React.useState(void 0);const rootRef=React.useRef(null);
const triggerRef=React.useRef(null);const searchRef=React.useRef(null);const menuFocusedRef=React.useRef(false);const listboxId=React.
useRef(`mcc-combo-list-${++comboSeq}`).current;const selected=options.find(option=>option.value===value);const visible=filterOptions(
options,query);const groups=groupModelsByProvider(visible);const close=()=>{setOpen(false);setQuery("");setActiveIndex(0);
setMenuStyle(void 0);menuFocusedRef.current=false};const toggleOpen=()=>{if(disabled)return;if(open){close();return}setActiveIndex(
Math.max(options.findIndex(option=>option.value===value),0));setOpen(true)};React.useEffect(()=>{if(!open)return void 0;
const updatePosition=()=>{const rect=triggerRef.current?.getBoundingClientRect();if(rect)setMenuStyle(floatingMenuLayout(
rect,window.innerWidth,window.innerHeight))};const closeOnOutside=event=>{if(!rootRef.current?.contains(event.target))close()};
const closeOnEscape=event=>{if(event.key==="Escape"){close();triggerRef.current?.focus()}};updatePosition();document.addEventListener(
"pointerdown",closeOnOutside);document.addEventListener("keydown",closeOnEscape);window.addEventListener("resize",updatePosition);
window.addEventListener("scroll",updatePosition,true);const reposition=window.setInterval(updatePosition,120);return()=>{
document.removeEventListener("pointerdown",closeOnOutside);document.removeEventListener("keydown",closeOnEscape);window.
removeEventListener("resize",updatePosition);window.removeEventListener("scroll",updatePosition,true);window.clearInterval(
reposition)}},[open]);React.useEffect(()=>{if(open&&menuStyle&&!menuFocusedRef.current){searchRef.current?.focus();menuFocusedRef.
current=true}const active=rootRef.current?.querySelector('[data-active="true"]');if(active&&active.scrollIntoView)active.
scrollIntoView({block:"nearest"})},[open,menuStyle,activeIndex]);const choose=option=>{onChange(option.value);close()};const moveActive=next=>setActiveIndex(
visible.length===0?0:(next+visible.length)%visible.length);const onMenuKeyDown=event=>{if(event.key==="ArrowDown"){event.
preventDefault();moveActive(activeIndex+1)}else if(event.key==="ArrowUp"){event.preventDefault();moveActive(activeIndex-
1)}else if(event.key==="Home"){event.preventDefault();setActiveIndex(0)}else if(event.key==="End"){event.preventDefault();
setActiveIndex(Math.max(visible.length-1,0))}else if(event.key==="Enter"&&visible[activeIndex]){event.preventDefault();choose(
visible[activeIndex])}};let rendered=0;return h("div",{className:"mcc-field"},h("span",{className:"mcc-label"},label),h(
"div",{className:"mcc-combo",ref:rootRef},h("button",{type:"button",disabled,ref:triggerRef,"aria-haspopup":"listbox","a\
ria-expanded":open,"aria-controls":open?listboxId:void 0,className:`mcc-combo-trigger${open?" open":""}`,title:selected?
`${selected.providerName} (${selected.provider}) · ${selected.model}`:void 0,onClick:toggleOpen,onKeyDown:event=>{if(!disabled&&
(event.key==="ArrowDown"||event.key==="ArrowUp")){event.preventDefault();toggleOpen()}}},h("span",{className:"mcc-combo-\
value"},h("span",{className:"mcc-combo-primary"},selected?.modelName||selected?.model||t("selectPlaceholder"))),h("span",
{className:"mcc-combo-chevron","aria-hidden":"true"})),open?h("div",{className:"mcc-combo-menu",style:menuStyle??{visibility:"\
hidden"}},h("div",{className:"mcc-combo-search-wrap"},h("input",{ref:searchRef,className:"mcc-combo-search",value:query,
placeholder:t("searchModels"),onChange:event=>{setQuery(event.target.value);setActiveIndex(0)},onKeyDown:onMenuKeyDown,"\
aria-label":t("searchModels"),"aria-controls":listboxId})),h("div",{className:"mcc-combo-list",role:"listbox",id:listboxId,
"aria-activedescendant":visible[activeIndex]?`${listboxId}-opt-${activeIndex}`:void 0},groups.length===0?h("div",{className:"\
mcc-combo-empty"},t("noMatches")):groups.map(group=>{const startIndex=rendered;rendered+=group.options.length;return h("\
div",{className:"mcc-combo-group",key:group.provider},h("div",{className:"mcc-combo-group-head"},h("span",{className:"mc\
c-combo-group-title"},group.title),group.provider!==group.title?h("span",{className:"mcc-combo-group-sub"},`· ${group.provider}`):
null),group.options.map((option,offset)=>{const index=startIndex+offset;return h("button",{type:"button",role:"option",id:`${listboxId}\
-opt-${index}`,"aria-selected":option.value===value,"data-active":index===activeIndex?"true":void 0,title:`${option.modelName}\

${option.providerName} (${option.provider}) · ${option.model}`,className:`mcc-combo-option${option.value===value?" sele\
cted":""}${index===activeIndex?" active":""}`,key:option.value,onClick:()=>choose(option),onMouseEnter:()=>setActiveIndex(
index)},h("span",{className:"mcc-combo-value"},h("span",{className:"mcc-combo-primary"},option.modelName)))}))}))):null))}
return ModelCombobox}function createBatchPanel(React){const h=React.createElement;function BatchPanel({rows,references,writable,saving,onSave,
onCancel,onManual,t}){const[choices,setChoices]=React.useState(()=>Object.fromEntries(rows.map(row=>[row.key,row.recommended?.
key??""])));const[checked,setChecked]=React.useState(()=>Object.fromEntries(rows.map(row=>[row.key,row.selectedByDefault])));
const selected=rows.filter(row=>checked[row.key]&&choices[row.key]);const disabled=saving||!writable;return h("section",
{className:"mcc-batch","aria-label":t("autoTitle")},h("div",{className:"mcc-batch-head"},h("h3",{className:"mcc-batch-ti\
tle"},t("autoTitle")),h("p",{className:"mcc-sub"},t("autoHint")),h("div",{className:"mcc-count"},t("referenceSummary",{count:references.
info.modelRecords,date:references.info.updatedAt.slice(0,10)})," · ",t(`references_${references.status}`)),h("div",{className:"\
mcc-batch-tools"},h("span",null,t("selectionSummary",{selected:selected.length,total:rows.length})),h("div",{className:"\
mcc-toolbar"},h("button",{type:"button",className:"mcc-btn",disabled,onClick:()=>setChecked(Object.fromEntries(rows.map(
row=>[row.key,Boolean(choices[row.key])])))},t("selectAll")),h("button",{type:"button",className:"mcc-btn",disabled,onClick:()=>setChecked(
{})},t("selectNone"))))),rows.length===0?h("div",{className:"mcc-empty"},t("noCandidates")):h("div",{className:"mcc-batc\
h-scroll"},h("table",{className:"mcc-batch-table"},h("thead",null,h("tr",null,h("th",{scope:"col"},t("select")),h("th",{
scope:"col"},t("chooseModel")),h("th",{scope:"col"},t("currentWindow")),h("th",{scope:"col"},t("referenceWindow")))),h("\
tbody",null,rows.map(row=>{const choice=row.choices.find(item=>item.key===choices[row.key]);const evidence=choice?.evidence[0];
return h("tr",{key:row.key},h("td",null,h("input",{type:"checkbox",className:"mcc-check",checked:Boolean(checked[row.key]&&
choice),"aria-label":t("selectRoute",{route:`${row.provider} / ${row.model}`}),disabled:disabled||!choice,onChange:event=>setChecked(
{...checked,[row.key]:event.target.checked})})),h("td",null,h("div",{className:"mcc-route"},row.modelName),h("div",{className:"\
mcc-batch-route"},`${row.provider} / ${row.model}`),h("div",{className:"mcc-batch-method"},t(row.hasReference?`match_${row.
method}`:row.currentWindow?"existingOnly":"unmatched"))),h("td",null,row.currentWindow?formatTokens(row.currentWindow):t(
"notDeclared"),h("div",{className:"mcc-batch-method"},t(`${row.reason}Window`))),h("td",null,row.choices.length?h(React.
Fragment,null,row.choices.length===1?h("div",{className:"mcc-route"},formatTokens(choice.contextWindow)):h("select",{className:"\
mcc-input",value:choices[row.key],disabled,"aria-label":t("chooseCapacity",{route:`${row.provider} / ${row.model}`}),onChange:event=>setChoices(
{...choices,[row.key]:event.target.value})},!choice?h("option",{value:"",disabled:true},t(row.conflict?"resolveConflict":
"chooseReference")):null,row.choices.map(item=>h("option",{key:item.key,value:item.key},`${formatTokens(item.contextWindow)}\
 · ${item.evidence.map(e=>e.scope==="configured"?t("keepCurrent"):e.scope==="model"?`${e.manufacturerName||e.provider} ${t(
"modelDefault")}`:e.providerName||e.provider).filter((v,i,values)=>values.indexOf(v)===i).join(" / ")}`))),evidence&&evidence.
scope!=="configured"?h("div",{className:"mcc-batch-method"},t("manufacturer",{name:evidence.manufacturerName||evidence.manufacturer||
t("unknownManufacturer")})):null,evidence?h("div",{className:"mcc-batch-method"},t(evidence.scope==="configured"?`fromCu\
rrent_${evidence.windowSource}`:evidence.scope==="model"?"fromModelDefault":"fromProvider",{name:evidence.providerName||
evidence.provider})):null,evidence?.sourceUrl?h("div",{className:"mcc-batch-evidence"},h("a",{href:evidence.sourceUrl,target:"\
_blank",rel:"noreferrer"},evidence.source),` · ${evidence.id}`):null):h("button",{type:"button",className:"mcc-btn",disabled,
onClick:()=>onManual(row)},t("manualCapacity"))))})))),h("div",{className:"mcc-batch-footer"},h("button",{type:"button",
className:"mcc-btn",disabled:saving,onClick:onCancel},t("cancel")),h("button",{type:"button",className:"mcc-btn primary",
disabled:disabled||selected.length===0,onClick:()=>onSave(Object.fromEntries(selected.map(row=>[row.key,choices[row.key]])))},
t("addSelected",{count:selected.length}))))}return BatchPanel}function createCatalogPage(React){const h=React.createElement;const ModelCombobox=createModelCombobox(React);const BatchPanel=createBatchPanel(
React);const useCatalogController=createCatalogController(React);function field(label,value,onChange,props={}){const control=props.
multiline?h("textarea",{className:"mcc-input mcc-textarea",value,placeholder:props.placeholder??"",onChange:event=>onChange(
event.target.value)}):h("input",{className:"mcc-input",value,type:props.type??"text",placeholder:props.placeholder??"",onChange:event=>onChange(
event.target.value),min:props.min});return h("label",{className:`mcc-field${props.full?" full":""}`},h("span",{className:"\
mcc-label"},label),control)}return function CatalogPage(props){const{t}=props;const{snapshot,piSnapshot,entries,options,
editingKey,route,windowValue,note,sourceUrl,error,saving,scanning,batch,message,setRoute,setWindowValue,setNote,setSourceUrl,
closeEditor,startAdd,startAuto,startEdit,submit,toggle,remove,addSelected,cancelBatch}=useCatalogController(props);const editor=title=>{
const selectedItem=editingKey&&editingKey!=="__new__"?entries[editingKey]:void 0;const editorOptions=route&&!options.some(
option=>option.value===route)&&selectedItem?[{value:route,provider:selectedItem.provider,providerName:selectedItem.provider,
model:selectedItem.model,modelName:selectedItem.model,searchText:`${selectedItem.provider} ${selectedItem.model}`.toLocaleLowerCase()},
...options]:options;return h("form",{className:"mcc-editor",onSubmit:submit},h("div",{className:"mcc-editor-title"},title),
h("div",{className:"mcc-form"},h(ModelCombobox,{label:t("chooseModel"),value:route,onChange:setRoute,options:editorOptions,
disabled:editingKey!=="__new__"||!snapshot.writable,t}),field(t("window"),windowValue,setWindowValue,{type:"number",min:1,
placeholder:"128000"}),field(t("sourceUrl"),sourceUrl,setSourceUrl,{full:true,placeholder:"https://…"}),field(t("note"),
note,setNote,{full:true,multiline:true,placeholder:t("notePlaceholder")}),editorOptions.length===0?h("div",{className:"m\
cc-error"},t("noConfiguredModels")):null,error?h("div",{className:"mcc-error"},error):null,h("div",{className:"mcc-form-\
actions"},h("button",{type:"button",className:"mcc-btn",onClick:closeEditor},t("cancel")),h("button",{type:"submit",className:"\
mcc-btn primary",disabled:saving||!snapshot.writable||editorOptions.length===0},saving?t("saving"):t("save")))))};const rows=Object.
entries(entries).sort((a,b)=>`${a[1].provider}/${a[1].model}`.localeCompare(`${b[1].provider}/${b[1].model}`));const activeCount=rows.
filter(([,item])=>item.enabled!==false).length;return h("div",{className:"mcc-page"},h("div",{className:"mcc-head"},h("d\
iv",{className:"mcc-heading"},h("h2",{className:"mcc-title"},t("title")),h("p",{className:"mcc-sub"},t("subtitle")),h("d\
iv",{className:"mcc-count"},t("summary",{active:activeCount,configured:options.length}))),h("div",{className:"mcc-toolba\
r"},h("button",{type:"button",className:"mcc-btn",onClick:editingKey==="__new__"?closeEditor:()=>startAdd(),disabled:saving||
scanning||snapshot.writable===false},editingKey==="__new__"?t("close"):t("add")),h("button",{type:"button",className:"mc\
c-btn primary",onClick:startAuto,disabled:saving||scanning||!snapshot.writable||piSnapshot.status!=="ready"},scanning?t(
"scanning"):t("autoAdd")))),snapshot.status==="unavailable"?h("div",{className:"mcc-notice"},t("catalogUnavailable")):null,
snapshot.status==="ready"&&snapshot.writable===false?h("div",{className:"mcc-notice"},t("readOnly")):null,piSnapshot.status===
"unavailable"?h("div",{className:"mcc-notice"},t("piUnavailable")):null,error&&editingKey===null?h("div",{className:"mcc\
-error",role:"alert"},error):null,message?h("div",{className:"mcc-notice",role:"status"},message):null,batch?h(BatchPanel,
{rows:batch.rows,references:batch.references,writable:snapshot.writable&&piSnapshot.status==="ready",saving,onSave:addSelected,
onCancel:cancelBatch,onManual:startAdd,t}):null,editingKey==="__new__"?h("div",{className:"mcc-new"},editor(t("addTitle"))):
null,rows.length===0?h("div",{className:"mcc-empty"},t("empty")):rows.map(([key,item])=>{const actual=actualContext(piSnapshot.
value,item.provider,item.model);const enabled=item.enabled!==false;const matched=actual!==void 0;const explicit=matched&&
actual.explicit&&actual.value!==void 0;const correct=explicit&&actual.value===item.contextWindow;const open=editingKey===
key;const syncNotice=enabled&&piSnapshot.status==="ready"&&!correct?t(matched?"syncPending":"routeMissing"):null;return h(
"div",{className:`mcc-card${open?" open":""}${enabled?"":" off"}`,key},h("div",{className:"mcc-row"},h("div",{className:"\
mcc-main"},h("div",{className:"mcc-route"},`${item.provider} / ${item.model}`),h("div",{className:"mcc-meta"},h("span",null,
`${t("window")}: ${formatTokens(item.contextWindow)}`)),item.note?h("div",{className:"mcc-meta"},readableSourceNote(item)):
null,syncNotice?h("div",{className:"mcc-sync-notice",role:"status"},syncNotice):null),h("div",{className:"mcc-actions"},
h("button",{type:"button",className:"mcc-btn",onClick:()=>open?closeEditor():startEdit(key,item)},open?t("close"):t("edi\
t")),h("button",{type:"button",className:"mcc-btn danger",onClick:()=>remove(key),disabled:saving||!snapshot.writable},t(
"remove")),h("label",{className:"mcc-toggle"},h("span",null,t("enable")),h("button",{type:"button",role:"switch",className:"\
mcc-switch","aria-label":t("manageRoute",{route:`${item.provider} / ${item.model}`}),"aria-checked":enabled,onClick:()=>toggle(
key,item),disabled:saving||!snapshot.writable},h("span",{className:"mcc-switch-thumb","aria-hidden":"true"}))))),open?editor(
t("editTitle")):null)}))}}var inject=["slots","locale","configForms","remote","remote.llm"];function createClientPlugin(React){const CatalogPage=createCatalogPage(
React);function apply(ctx){const t=ctx.locale.bind(LOCALE_NAMESPACE);const catalogScope=ctx.configForms.get(CATALOG_SETTINGS_NAMESPACE);
const piScope=ctx.configForms.get(MODEL_SETTINGS_NAMESPACE);const catalogLoader=createCatalogLoader();const remote=ctx.get?.(
"remote")??ctx.remote;const discoverBuiltin=remote?.llm?.discoverModels?provider=>remote.llm.discoverModels(MODEL_SETTINGS_NAMESPACE,
{provider}):void 0;ctx.effect(installStyles,"model-context-catalog: settings styles");ctx.effect(()=>ctx.locale.register(
LOCALE_NAMESPACE,dictionaries),"model-context-catalog: dictionaries");ctx.slots.inject("settings.section",()=>ctx.slots.
register({name:"settings.section",id:"model-context-catalog",order:11,label:()=>t("nav"),inject:()=>({catalogScope,piScope,
discoverBuiltin,catalogLoader,t})},CatalogPage))}const plugin={apply,inject,configuredModels,groupModelsByProvider,filterOptions,
floatingMenuLayout,entryMutations,actualContext};Object.defineProperty(plugin,Symbol.toStringTag,{value:"Module"});return plugin}window.__ModuleLoader__.load({id:CLIENT_ID,factory:require2=>createClientPlugin(require2("react"))});})();
