package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={profile={'student'},directory='/tmp'},doc={input_file='nonbank.qmd',is_format=function()return false end}}
local visibility=require('visibility')
return {{Pandoc=function(input)
 local function project(attrs,meta)
  return pandoc.write(visibility.prepare(pandoc.read('---\ncourse: {id: probe, view: student}\n'..(meta or '')..'---\n::: {#exr-one '..attrs..'}\nPUBLIC_CONDITION\n:::\n\n::: {#sol-one}\nSOLUTION_PAYLOAD\n:::\n','markdown')),'markdown')
 end
 local native=project('statement-visibility=restricted')
 assert(native:find('PUBLIC_CONDITION',1,true) and native:find('SOLUTION_PAYLOAD',1,true),'unmanaged_native_attributes_preserve_parity')
 local defaultOnly=project('', 'default-exercise-time: 10\n')
 assert(defaultOnly:find('SOLUTION_PAYLOAD',1,true),'nonbank_defaults_do_not_change_native_solution_semantics')
 local restricted=project('project="/projects/closed" statement-visibility=restricted')
 assert(not restricted:find('PUBLIC_CONDITION',1,true) and not restricted:find('SOLUTION_PAYLOAD',1,true),'managed_nonbank_restricted_closes_sibling_solution')
 local ordinary=project('project="/projects/open" statement-visibility=open')
 assert(ordinary:find('PUBLIC_CONDITION',1,true) and not ordinary:find('SOLUTION_PAYLOAD',1,true),'managed_nonbank_ordinary_solution_private')
 local demo=project('project="/projects/demo" statement-visibility=open','default-exercise-course-role: demonstration\n')
 assert(demo:find('PUBLIC_CONDITION',1,true) and demo:find('SOLUTION_PAYLOAD',1,true),'inherited_nonbank_demonstration_solution_public')
 local nativeDemo=project('project="/projects/demo" course-role=demonstration')
 assert(nativeDemo:find('SOLUTION_PAYLOAD',1,true),'nonbank_native_open_shared_effective_visibility')
 io.stderr:write('PASS unmanaged native parity and managed nonbank statement/solution privacy\n');return input
end}}
