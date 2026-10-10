package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={profile={}},doc={input_file='adapter.qmd'}}
local adapters=require('native-adapters')
return {{Pandoc=function(input)
 pandoc.system.with_temporary_directory('core-adapter-facts',function(root)
  quarto.project.directory=root;pandoc.system.make_directory(root..'/_extensions/demo',true)
  local function write(name,content)local f=assert(io.open(root..'/_extensions/demo/'..name,'w'));f:write(content);f:close()end
  write('contract.json','{"name":"demo","rules":"spec.cue"}')
  write('validate.lua','return {validate=function(doc,facts) assert(facts["exr-one"].target=="demo","validator missing effective facts") end}')
  write('native.lua','return {read=function(doc,facts) assert(facts["exr-one"].target=="demo","reader missing effective facts");return {ok=true} end,write=function(doc,value) doc.meta["adapter-witness"]=value.ok end}')
  local doc=pandoc.read('---\ncourse: {id: probe, adapters: [demo]}\nexercise-bank: true\n---\n::: {#exr-one}\n## Task\nCondition\n:::\n','markdown')
  local facts={['exr-one']={target='demo'}}
  adapters.validate(doc,facts)
  assert(type(adapters.read)=='function','adapter effective reader missing')
  adapters.read(doc,facts)
  assert(doc.meta['adapter-witness']==true,'current adapter fragment not written')
 end)
 io.stderr:write('PASS adapter validate/read receive one shared effective facts table\n');return input
end}}
