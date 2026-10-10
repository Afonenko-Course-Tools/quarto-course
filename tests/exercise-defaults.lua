package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={directory='/tmp',profile={}},doc={input_file='defaults.qmd',is_format=function()return false end}}
local function doc(metadata,attrs)
 return pandoc.read('---\ncourse: {id: model}\nexercise-bank: true\n'..metadata..'\n---\n# Topic {#sec-topic}\n\n::: {#exr-one '..(attrs or '')..'}\n## Task\nCondition\n:::\n','markdown')
end
return {{Pandoc=function(input)
 local ok,module=pcall(require,'exercise-defaults')
 assert(ok,'exercise-defaults normalization missing')
 local d=doc('default-exercise-target: manual\ndefault-exercise-difficulty: introductory\ndefault-exercise-time: 90\ndefault-exercise-statement-visibility: open')
 local f=module.normalize(d)['exr-one']
 assert(f.target=='manual' and f.authoredTarget==nil and f.time==90 and f.difficulty=='introductory' and f.statementVisibility=='open','effective defaults lost')
 assert(d.blocks[2].attributes.target==nil,'normalizer rewrote authored AST')
 local function reject(meta,attrs,code)
  local success,err=pcall(module.normalize,doc(meta,attrs));assert(not success and tostring(err):find(code,1,true),tostring(err))
 end
 reject('default-exercise-target: prairielearn','target=manual','CORE.EXERCISE_DEFAULT_CONFLICT')
 reject('default-exercise-time: 1.5','','CORE.METADATA_INVALID')
 reject('exercise-statement-visibility: open\ndefault-exercise-statement-visibility: restricted','','CORE.METADATA_INVALID')
 reject('exercise-statement-visibility: open\ndefault-exercise-statement-visibility: false','','CORE.METADATA_INVALID')
 reject('default-exercise-extra: x','','CORE.METADATA_INVALID')
 for field,value in pairs({target='manual',['course-role']='independent-study',['statement-visibility']='open',difficulty='introductory',time='10',['project-check']='junit'}) do
  reject('default-exercise-'..field..': ['..value..']','','CORE.METADATA_INVALID')
  reject('default-exercise-'..field..': {value: '..value..'}','','CORE.METADATA_INVALID')
 end
 reject('default-exercise-time: [10]','','CORE.METADATA_INVALID')
 reject('default-exercise-target: null','','CORE.METADATA_INVALID')
 reject('default-exercise-target: ""','','CORE.METADATA_INVALID')
 local override=module.normalize(doc('default-exercise-target: false\ndefault-exercise-statement-visibility: open','target=manual statement-visibility=restricted time=10 difficulty=advanced'))['exr-one']
 assert(override.target=='manual' and override.statementVisibility=='restricted','clear/default override failed')
 local same=module.normalize(doc('default-exercise-target: manual','target=manual'))['exr-one'];assert(same.target=='manual' and same.authoredTarget=='manual','matching explicit target rejected')
 local outside=doc('default-exercise-time: 90','');outside.meta['exercise-bank']=false
 assert(not module.normalize(outside)['exr-one'].banked,'default enabled bank')
 local hidden=doc('', '');hidden.blocks:insert(pandoc.Div({pandoc.Para('hidden')},pandoc.Attr('',{'content-visible'},{['when-profile']='full'})))
 local success,err=pcall(module.normalize,hidden);assert(not success and tostring(err):find('CORE.AUDIENCE_WRAPPER_FORBIDDEN',1,true),'audience wrapper accepted')
 io.stderr:write('PASS effective defaults, conflict, clearing, provenance and non-bank isolation\n')
 return input
end}}
