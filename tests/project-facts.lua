package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={directory='/tmp'},doc={input_file='projects.qmd'}}
return {{Pandoc=function(input)
 local ok,projects=pcall(require,'projects');assert(ok,'projects collector missing')
 local defaults=require('exercise-defaults')
 local function doc(attr,meta)
 return pandoc.read('---\ncourse: {id: model}\nproject-checks:\n  defaults: {runtime: java25-junit-v1, scoring: {mode: weighted}}\n  source-profiles:\n    main: {mode: implementation, root: student, include: ["*.java"]}\n  profiles:\n    junit: {source-profile: main, tests: ["tests/*Test.java"]}\n'..(meta or '')..'---\n::: {#exr-demo project="/projects/demo" '..attr..'}\n## Demo\nText\n:::\n','markdown')
 end
 local function collect(d)return projects.collect(d,defaults.normalize(d)) end
 assert(collect(doc(''))[1].check==nil,'manual without check opted in')
 local fact=collect(doc('course-role=demonstration statement-visibility=open project-check=junit'))[1]
 assert(not fact.bankMember and fact.check.profile=='junit' and fact.check.runtime=='java25-junit-v1','manual checked demo banked or check not resolved')
 assert(fact.artifactPolicy.student=='full','open demo full artifact denied')
 assert(collect(doc('','default-exercise-project-check: junit\n'))[1].check.profile=='junit','inherited check lost')
 assert(collect(doc('','default-exercise-project-check: false\n'))[1].check==nil,'cleared check retained')
 local success,err=pcall(collect,doc('project-check=unknown'));assert(not success and tostring(err):find('project-check',1,true),'unknown check accepted')
 local missing=doc('project-check=junit');missing.blocks[1].attributes.project=nil
 success,err=pcall(collect,missing);assert(not success,'check without project accepted')
 local bad=doc('project-check=junit');bad.meta['project-checks'].profiles.junit.bad=pandoc.MetaString('x')
 success,err=pcall(collect,bad);assert(not success,'unknown check field accepted')
 io.stderr:write('PASS explicit/inherited project checks, non-bank demo and artifact policy\n');return input
end}}
