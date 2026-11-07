---@meta
-- Дополнение только фактических пробелов bundled Quarto1.11.5 typings.
-- Этот library-only файл не подключается фильтрами во время исполнения.
-- Привязки пространства имён используют поля штатной библиотеки, без any.
---@class pandoc
pandoc = pandoc
---@class quarto
quarto = quarto

---@class CourseNativeWalkFilter
---@field traverse? 'topdown'|'typewise'
---@field Div? fun(node:pandoc.Div):(pandoc.Div|pandoc.Blocks|pandoc.Block[]|nil, boolean?)
---@field Span? fun(node:pandoc.Span):(pandoc.Span|pandoc.Inlines|nil)
---@field Link? fun(node:pandoc.Link):nil
---@field Image? fun(node:pandoc.Image):nil

---@class pandoc.Blocks
---@field [integer] pandoc.Block
---@field walk fun(self:pandoc.Blocks,filter:CourseNativeWalkFilter):pandoc.Blocks

---@class pandoc.Div
---@field content pandoc.Blocks

---@class pandoc.Inlines
---@field [integer] pandoc.Inline

---@class pandoc.Block
---@field t string

---@class pandoc.Inline
---@field t string

-- JSON transport использует decode(..., false), чтобы Pandoc не материализовал
-- JSON обратно в userdata AST. Null — штатный light userdata pandoc.json.null.
-- Первичный договор: https://pandoc.org/lua-filters.html#module-pandoc.json
---@class CourseJsonNull: userdata
---@alias CourseJsonValue boolean|number|string|CourseJsonNull|table<string|integer,CourseJsonValue>
---@class CoursePandocJson
pandoc.json = {}
---@type CourseJsonNull
pandoc.json.null = nil
---@param source string
---@param pandoc_types? boolean
---@overload fun(source:string,pandoc_types:false):CourseJsonValue
---@return unknown
function pandoc.json.decode(source, pandoc_types) end
---@param value unknown
---@return string
function pandoc.json.encode(value) end

---@class CourseNativeFormatIdentifier
---@field ['target-format'] string
---@field ['base-format'] string
---@return CourseNativeFormatIdentifier
function quarto.format.format_identifier() end

-- Штатный utils.lua не объявляет фактический результат native JSON filter.
---@param doc pandoc.Pandoc
---@param filter string
---@param args? string[]
---@return pandoc.Pandoc
function pandoc.utils.run_json_filter(doc, filter, args) end
