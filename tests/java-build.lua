package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={directory='/tmp'},doc={input_file='java-build.qmd'}}
return {{Pandoc=function(input)
 local projects=require('projects')
 local function resolve(overlay,mode,artifact)
  local doc=pandoc.read('---\nproject-checks:\n  defaults: {scoring: {mode: weighted}}\n  source-profiles:\n    main: {mode: '..(mode or 'implementation')..', root: student, include: ["*.java"]}\n  profiles:\n    jar:\n      source-profile: main\n      tests: ["tests/*.java"]\n'..overlay..'---\n','markdown')
  if artifact then doc.meta['project-checks'].profiles.jar['java-build'].artifact=pandoc.MetaString(artifact) end
  return projects.resolve(projects.configuration(doc.meta),'jar','exr-jar')
 end
 local build='      java-build: {kind: gradle-jar-v1, main-class: grade.Main, artifact: gradeapp.jar}\n'
 local native='      runtime: java25-gradle-junit-v1\n'
 local value=resolve(native..build)
 assert(value['java-build'].kind=='gradle-jar-v1' and value['java-build']['main-class']=='grade.Main' and value['java-build'].artifact=='gradeapp.jar','native java-build capture lost')
 local api=resolve(native..build..'      api-precheck: {files: ["tests/Api.java"], entry: grade.Api}\n      additional-java-sources: {archive: extra.zip, max-files: 1, max-file-bytes: 100, max-total-bytes: 100, max-archive-bytes: 100}\n')
 assert(api['api-precheck'].entry=='grade.Api' and api['additional-java-sources'].archive=='extra.zip','native Java API/extras rejected')
 for _,overlay in ipairs({native,'      runtime: java25-junit-v1\n'..build,'      runtime: java25-junit-mutation-v1\n'..build,'      runtime: fish-git-v1\n'..build,native..build:gsub('gradle%-jar%-v1','unknown'),native..build:gsub('artifact: gradeapp.jar','artifact: gradeapp.jar, command: run'),native..build:gsub('main%-class: grade.Main, ',''),native..build:gsub('main%-class: grade.Main','main-class: grade..Main')}) do
  assert(not pcall(resolve,overlay),'invalid java-build coupling/shape accepted: '..overlay)
 end
 for _,artifact in ipairs({'../x.jar','/x.jar','.hidden.jar','x/y.jar','x\\y.jar','C:x.jar','x*.jar','x?.jar','x..jar','x.zip',string.rep('a',102)..'.jar'}) do
  assert(not pcall(resolve,native..build,nil,artifact),'unsafe JAR artifact accepted: '..artifact)
 end
 assert(not pcall(resolve,native..build,'student-tests'),'mutation mode accepted java-build')
 assert(resolve('      runtime: java25-junit-v1\n')['java-build']==nil,'plain Java acquired java-build')
 io.stderr:write('PASS native java-build capture, closed coupling, API/extras and unsafe names\n');return input
end}}
