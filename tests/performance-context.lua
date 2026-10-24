-- Проверяет реальные handlers при смене native документа после загрузки фильтра.
local observed={}
local function wrap(spec,fn) observed[#observed+1]=spec;return fn end
_G.__course_performance_agent_v1={abiVersion=1,metrics={wrap_sync=wrap,wrap_walk=wrap,child_env=function(env)return env end}}
local root=os.getenv('CANONICAL_EXTENSION')..'/..'
local function load_module(extension,file)
 local env=setmetatable({},{__index=_G})
 env.quarto={doc={input_file='import.qmd',is_format=function()return false end},project={},format={is_format=function()return false end}}
 local cache={}
 local function load(path)
  path=pandoc.path.normalize(path)
  if cache[path] then return cache[path] end
  local moduleEnv=setmetatable({},{__index=env})
  moduleEnv.require=function(name)
   if name:sub(1,1)=='.' then return load(pandoc.path.directory(path)..'/'..name..'.lua') end
   return require(name)
  end
  local result=assert(loadfile(path,'t',moduleEnv))();cache[path]=result;return result
 end
 return load(root..'/'..extension..'/'..file),env
end
return {{Pandoc=function(doc)
 for _,case in ipairs({{'course-core','filter.lua'},{'course-presentation','filter.lua'},{'course-navigation','filter.lua'},{'course-navigation','shortcodes.lua'}}) do
  local extension,file=case[1],case[2]
  local filters,env=load_module(extension,file)
  local handler=file=='shortcodes.lua' and function()return filters['course-exercise-index']({}, {}, {})end or filters[1].Pandoc
  local operation=file=='shortcodes.lua' and 'course-navigation.shortcodes.handler.course-exercise-index' or extension..'.filter.handler.Pandoc'
  for _,source in ipairs({'first.qmd','second.qmd'}) do
   env.quarto.doc.input_file=source
   handler(pandoc.Pandoc({}))
   local found=false
   for _,spec in ipairs(observed) do
    if spec.id==operation and spec.document_id==source and spec.attributes and spec.attributes.extension_id==extension then found=true end
   end
   assert(found,extension..': отсутствует контекст вызова '..source)
  end
 end
 print('PASS Lua runtime document/extension context for all three filters')
 return doc
end}}
