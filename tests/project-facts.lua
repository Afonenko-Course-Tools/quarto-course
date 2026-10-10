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
 local function resolveOverlay(overlay)
  local d=pandoc.read([[---
project-checks:
  defaults:
    runtime: java25-junit-v1
    java: {release: 25, compiler-options: ["-proc:none", "-Xmaxerrs", "5"]}
    variants: {correct: [one, two], mutants: [bad-one, bad-two]}
    scoring: {mode: contract-groups, groups: [{id: first, weight: 1, tests: [a]}, {id: second, weight: 2, tests: [b]}]}
  source-profiles:
    main: {mode: implementation, root: student, include: ["*.java"]}
  profiles:
    junit:
      source-profile: main
      tests: ["tests/*Test.java"]
]]..overlay..'---\n','markdown')
  return projects.resolve(projects.configuration(d.meta),'junit','exr-array')
 end
 local shorter=resolveOverlay('      java: {compiler-options: ["-g:none"]}\n      variants: {correct: [three], mutants: [bad-three]}\n      scoring: {groups: [{id: third, weight: 3, tests: [c]}]}\n')
 assert(#shorter.java['compiler-options']==1 and shorter.java.release==25,'nested compiler array retained inherited tail')
 assert(#shorter.variants.correct==1 and #shorter.variants.mutants==1,'nested variant arrays retained tails')
 assert(#shorter.scoring.groups==1 and shorter.scoring.groups[1].id=='third','scoring groups retained inherited tail')
 local empty=resolveOverlay('      java: {compiler-options: []}\n      variants: {correct: [], mutants: []}\n')
 assert(#empty.java['compiler-options']==0 and #empty.variants.correct==0 and #empty.variants.mutants==0,'empty nested array did not replace')
 local emptyGroups,emptyError=pcall(resolveOverlay,'      scoring: {groups: []}\n')
 assert(not emptyGroups and tostring(emptyError):find('scoring.groups',1,true),'empty scoring groups inherited defaults instead of failing min-items')
 local expectation=resolveOverlay('      verification-expectations:\n        starter:\n          classification: behavior-failure\n          failed-tests: {at-least: 1, exactly: 2}\n          executed-tests: {at-least: 2, exactly: 3}\n          test-ids: [sample-one, sample-two]\n          score: {less-than: 1, at-least: 0, exactly: 0.5}\n')
 local e=expectation['verification-expectations'].starter
 local evidence=os.getenv('CORE_EXPECTATION_EVIDENCE')
 if evidence then local file=assert(io.open(evidence,'w'));file:write(pandoc.json.encode(expectation));file:close() end
 for _,overlay in ipairs({'      verification-expectations: {starter: {failed-tests: {exactly: -1}}}\n','      verification-expectations: {starter: {executed-tests: {exactly: 0.5}}}\n','      verification-expectations: {starter: {score: {unknown: 1}}}\n'}) do assert(not pcall(resolveOverlay,overlay),'invalid shared expectation accepted') end
 assert(e.classification=='behavior-failure' and e['failed-tests']['exactly']==2 and e['executed-tests']['at-least']==2 and e.score.exactly==0.5 and #e['test-ids']==2,'expectation schema parity failed')
 io.stderr:write('PASS explicit/inherited project checks, non-bank demo and artifact policy\n');return input
end}}
