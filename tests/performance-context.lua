-- Проверяет реальные handlers при смене native документа после загрузки фильтра.
---@class FixtureOperationSpec
---@field id string
---@field document_id? string
---@field attributes? table<string,string>
---@type FixtureOperationSpec[]
local observed = {}
---@generic F:function
---@param spec FixtureOperationSpec
---@param fn F
---@return F
local function wrap(spec, fn)
  observed[#observed + 1] = spec
  return fn
end
---@param env table<string,string>
---@return table<string,string>
local function child_env(env)
  return env
end
_G.__course_performance_agent_v1 =
  { abiVersion = 1, metrics = { wrap_sync = wrap, wrap_walk = wrap, child_env = child_env } }
local root = assert(os.getenv("CANONICAL_EXTENSION")) .. "/.."
---@class FixtureQuarto
---@field doc {input_file:string,is_format:fun():boolean}
---@field project table<string,unknown>
---@field format {is_format:fun():boolean}
---@class FixtureEnvironment
---@field quarto FixtureQuarto
---@field require? fun(name:string):unknown,unknown?

-- Lua chunk может вернуть любое штатное значение; до чтения нужна table-проверка.
---@param value nil|boolean|number|string|table|function|userdata|thread
---@return table
local function module_table(value)
  assert(type(value) == "table", "Fixture module должен вернуть таблицу")
  return value
end
---@param extension string
---@param file string
---@return table,FixtureEnvironment
local function load_module(extension, file)
  ---@type FixtureEnvironment
  local env = {
    quarto = {
      doc = {
        input_file = "import.qmd",
        is_format = function()
          return false
        end,
      },
      project = {},
      format = {
        is_format = function()
          return false
        end,
      },
    },
  }
  setmetatable(env, { __index = _G })
  ---@type table<string,table>
  local cache = {}
  ---@param path string
  ---@return table
  local function load(path)
    path = pandoc.path.normalize(path)
    if cache[path] then
      return cache[path]
    end
    ---@type FixtureEnvironment
    local moduleEnv = { quarto = env.quarto }
    setmetatable(moduleEnv, { __index = env })
    ---@param name string
    ---@return unknown,unknown?
    moduleEnv.require = function(name)
      if name:sub(1, 1) == "." then
        return load(pandoc.path.directory(path) .. "/" .. name .. ".lua")
      end
      return require(name)
    end
    local chunk = assert(loadfile(path, "t", moduleEnv))
    local result = module_table((chunk()))
    cache[path] = result
    return result
  end
  return load(root .. "/" .. extension .. "/" .. file), env
end
---@param doc pandoc.Pandoc
---@return pandoc.Pandoc
local function verify(doc)
  for _, case in ipairs({
    { "course-presentation", "filter.lua" },
    { "course-navigation", "filter.lua" },
    { "course-navigation", "shortcodes.lua" },
  }) do
    local extension, file = case[1], case[2]
    local filters, env = load_module(extension, file)
    assert(type(filters) == "table")
    local operation = file == "shortcodes.lua" and "course-navigation.shortcodes.handler.course-exercise-index"
      or extension .. ".filter.handler.Pandoc"
    for _, source in ipairs({ "first.qmd", "second.qmd" }) do
      env.quarto.doc.input_file = source
      if file == "shortcodes.lua" then
        assert(type(filters["course-exercise-index"]) == "function")
        filters["course-exercise-index"]({}, {}, {})
      else
        assert(type(filters[1]) == "table" and type(filters[1].Pandoc) == "function")
        filters[1].Pandoc(pandoc.Pandoc(pandoc.Blocks({})))
      end
      local found = false
      for _, spec in ipairs(observed) do
        if
          spec.id == operation
          and spec.document_id == source
          and spec.attributes
          and spec.attributes.extension_id == extension
        then
          found = true
        end
      end
      assert(found, extension .. ": отсутствует контекст вызова " .. source)
    end
  end
  print(
    "PASS Lua runtime document/extension context for Presentation/Navigation handlers; Core phase is checked by TS runtime"
  )
  return doc
end
return { { Pandoc = verify } }
