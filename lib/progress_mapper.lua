local cjson = require "cjson.safe"

local ProgressMapper = {}

local function clamp(value, min_value, max_value)
    if type(value) ~= "number" then
        return nil
    end
    if value < min_value then
        return min_value
    end
    if value > max_value then
        return max_value
    end
    return value
end

local function safe_decode(json_string)
    if type(json_string) ~= "string" or json_string == "" then
        return nil
    end
    local decoded, err = cjson.decode(json_string)
    if err then
        return nil, err
    end
    if type(decoded) == "table" then
        return decoded
    end
end

local function safe_encode(lua_value)
    if type(lua_value) ~= "table" then
        return nil
    end
    local encoded, err = cjson.encode(lua_value)
    if err then
        return nil, err
    end
    return encoded
end

local function normalize_index(index)
    if index == nil then
        return nil
    end
    local numeric = tonumber(index)
    if not numeric then
        return nil
    end
    if numeric >= 1 then
        return math.floor(numeric + 0.5)
    elseif numeric >= 0 then
        return math.floor(numeric) + 1
    end
end

local function resolve_chapter_context(progress_data)
    if type(progress_data) ~= "table" then
        return nil, nil
    end
    local chapter_field = progress_data.chapter or progress_data.chapter_index or progress_data.chapterIndex
    local chapter_progress = progress_data.chapter_progress
        or progress_data.chapterProgress
        or progress_data.chapter_percentage
        or progress_data.chapterPercent
        or progress_data.chapterPercentage
    local chapter
    local percent
    if type(chapter_field) == "table" then
        chapter = normalize_index(chapter_field.index or chapter_field.number or chapter_field.id)
        percent = tonumber(chapter_field.progress or chapter_field.percentage or chapter_field.percent)
    else
        chapter = normalize_index(chapter_field)
        percent = tonumber(chapter_progress)
    end
    return chapter, percent
end

local function extract_progress_table(raw_progress)
    local progress_data = safe_decode(raw_progress)
    if progress_data then
        return progress_data
    end
    return nil
end

local function clone_table(original)
    if type(original) ~= "table" then
        return {}
    end
    local copy = {}
    for key, value in pairs(original) do
        if type(value) == "table" then
            copy[key] = clone_table(value)
        else
            copy[key] = value
        end
    end
    return copy
end

local function build_track_timeline(item)
    local media = type(item) == "table" and item.media
    local audiobook = media and (media.audiobook or media.audioBook)
    local raw_tracks =
        (audiobook and (audiobook.tracks or audiobook.audioFiles))
        or (media and media.audioFiles)
        or (media and media.tracks)
    local tracks = {}
    local total_duration = 0
    if type(raw_tracks) == "table" then
        for index, track in ipairs(raw_tracks) do
            local duration = tonumber(track.duration or (track.metadata and track.metadata.duration))
            if duration and duration > 0 then
                local start_offset = tonumber(track.startOffset or track.offset or track.start)
                if not start_offset then
                    start_offset = total_duration
                elseif start_offset < total_duration then
                    start_offset = total_duration
                end
                table.insert(tracks, {
                    index = track.index or track.order or track.part or index,
                    start = start_offset,
                    duration = duration,
                    title = track.title or track.name,
                })
                local track_end = start_offset + duration
                if track_end > total_duration then
                    total_duration = track_end
                end
            end
        end
    end
    if total_duration == 0 then
        total_duration = tonumber(media and media.duration)
    end
    return tracks, total_duration
end

local function build_chapter_timeline(item, total_duration)
    local media = type(item) == "table" and item.media
    local audiobook = media and (media.audiobook or media.audioBook)
    local raw_chapters =
        (audiobook and audiobook.chapters)
        or (media and media.chapters)
        or (item and item.chapters)
    local chapters = {}
    if type(raw_chapters) == "table" then
        for index, chapter in ipairs(raw_chapters) do
            local start = tonumber(chapter.start or chapter.startOffset or chapter.offset or chapter.time)
            local finish = tonumber(chapter.finish or chapter["end"] or chapter.endOffset)
            if not start then
                if #chapters > 0 then
                    start = chapters[#chapters].finish
                else
                    start = 0
                end
            end
            local next_start = nil
            if not finish and raw_chapters[index + 1] then
                next_start = tonumber(raw_chapters[index + 1].start or raw_chapters[index + 1].startOffset)
            end
            if not finish then
                if next_start then
                    finish = next_start
                else
                    finish = total_duration
                end
            end
            finish = finish or start
            local duration = 0
            if finish and start then
                duration = math.max(0, finish - start)
            end
            table.insert(chapters, {
                index = index,
                start = start or 0,
                finish = finish or start or 0,
                duration = duration,
                title = chapter.title or chapter.name or chapter.label,
            })
        end
    end
    return chapters
end

function ProgressMapper.build_timeline(item)
    local tracks, total_duration = build_track_timeline(item)
    local chapters = build_chapter_timeline(item, total_duration)
    if (not total_duration or total_duration == 0) and #chapters > 0 then
        total_duration = chapters[#chapters].finish
    end
    return {
        total_duration = total_duration,
        tracks = tracks,
        chapters = chapters,
    }
end

function ProgressMapper.extract_ebook_location(raw_progress)
    local progress_data = extract_progress_table(raw_progress)
    if type(progress_data) ~= "table" then
        return nil, nil
    end
    local location = progress_data.cfi
        or progress_data.location
        or progress_data.epubcfi
        or (type(progress_data.anchor) == "table" and progress_data.anchor.cfi)
        or progress_data.anchor
    if type(location) ~= "string" then
        location = nil
    end
    return location, progress_data
end

local function clamp_time(total_duration, value)
    if type(total_duration) ~= "number" or total_duration <= 0 then
        return clamp(value or 0, 0, math.huge)
    end
    return clamp(value or 0, 0, total_duration)
end

local function find_chapter_by_index(chapters, index)
    if type(index) ~= "number" then
        return nil
    end
    if type(chapters) ~= "table" then
        return nil
    end
    if chapters[index] then
        return chapters[index]
    end
    if chapters[index + 1] then
        return chapters[index + 1]
    end
end

local function find_chapter_by_time(chapters, current_time)
    if type(chapters) ~= "table" then
        return nil
    end
    for _, chapter in ipairs(chapters) do
        if chapter.start and chapter.finish and current_time >= chapter.start and current_time < chapter.finish + 0.001 then
            return chapter
        end
    end
end

function ProgressMapper.ebook_to_audio(percentage, raw_progress, timeline)
    if type(timeline) ~= "table" then
        return nil
    end
    local total_duration = timeline.total_duration
    if not total_duration or total_duration <= 0 then
        return nil
    end
    local clamped_percentage = clamp(tonumber(percentage) or 0, 0, 1)
    local fallback_time = clamped_percentage * total_duration
    local location, progress_data = ProgressMapper.extract_ebook_location(raw_progress)
    local chapter_index, chapter_percent = resolve_chapter_context(progress_data)
    local chapter = find_chapter_by_index(timeline.chapters, chapter_index)
    local resolved_time = fallback_time
    if chapter and chapter.duration and chapter.duration > 0 then
        local percent_within = clamp(tonumber(chapter_percent) or 0, 0, 1)
        resolved_time = chapter.start + percent_within * chapter.duration
    elseif chapter then
        resolved_time = chapter.start
    end
    resolved_time = clamp_time(total_duration, resolved_time)
    return resolved_time, total_duration, location, progress_data
end

function ProgressMapper.audio_to_ebook(current_time, timeline, existing_progress)
    if type(timeline) ~= "table" then
        return nil
    end
    local total_duration = timeline.total_duration
    if not total_duration or total_duration <= 0 then
        return nil
    end
    local numeric_time = clamp_time(total_duration, tonumber(current_time) or 0)
    local percentage = clamp(numeric_time / total_duration, 0, 1)
    local progress_data = extract_progress_table(existing_progress)
    if type(progress_data) ~= "table" then
        progress_data = {}
    else
        progress_data = clone_table(progress_data)
    end
    progress_data.audiobookshelf = progress_data.audiobookshelf or {}
    progress_data.audiobookshelf.current_time = numeric_time
    progress_data.audiobookshelf.percentage = percentage
    local chapter = find_chapter_by_time(timeline.chapters, numeric_time)
    if chapter then
        progress_data.chapter = progress_data.chapter or chapter.index
        local duration = chapter.duration
        if duration and duration > 0 then
            progress_data.chapter_progress = clamp((numeric_time - chapter.start) / duration, 0, 1)
        end
    end
    local encoded = safe_encode(progress_data)
    return percentage, encoded or existing_progress, progress_data
end

function ProgressMapper.build_extra_payload(existing_extra, fields)
    local extra = {}
    if type(existing_extra) == "table" then
        extra = clone_table(existing_extra)
    end
    extra.koreader = extra.koreader or {}
    for key, value in pairs(fields or {}) do
        extra.koreader[key] = value
    end
    return extra
end

return ProgressMapper
