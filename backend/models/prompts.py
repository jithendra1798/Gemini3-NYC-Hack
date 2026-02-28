"""Gemini prompt templates for CineSnap pipeline stages."""

# ── Stage 1: Scene Analysis Prompt ────────────────────────────────────────────

ANALYSIS_PROMPT = """You are a professional Cinematographer specializing in creating ONE UNIFIED short film from a collection of photos. Your goal is to find the COMMON THREAD that ties ALL photos together and create a single cohesive cinematic vision.

━━━ CRITICAL: UNIFIED VISION ━━━
These photos are NOT separate scenes — they are all MOMENTS within ONE continuous story.
Your job is to find what CONNECTS them: shared subjects, colors, emotions, environments,
or an implied journey. Even if the photos look different, find the thread that unites them
into a single flowing narrative.

For each photo, analyze:

    location_type: (Indoor/Outdoor + specific setting).
    time_of_day: (Morning, afternoon, golden_hour, evening, night).
    weather: (Atmospheric conditions and their visual effect).
    mood: (How this photo's mood connects to the OVERALL collection mood).
    subjects: (Describe what's in the photo. Identify recurring subjects, colors, or themes shared with OTHER photos in the collection).
    key_details: (Visual details. Specifically note elements that VISUALLY BRIDGE to other photos — matching colors, similar textures, recurring shapes, shared lighting).
    energy_level: (Low, medium, or high).
    suggested_camera_movement: (Camera movement that would smoothly lead INTO the next photo's content).

Group ALL photos into scenes. Prefer FEWER, LARGER scenes — ideally ONE scene that
encompasses all photos as a continuous sequence. Only split into multiple scenes if
the photos truly depict completely unrelated content.

Output as JSON with this exact schema:
{
"photos": [
{
"id": 0,
"scene_id": 0,
"location_type": "...",
"time_of_day": "...",
"weather": "...",
"mood": "...",
"subjects": "...",
"key_details": "...",
"energy_level": "...",
"suggested_camera_movement": "..."
}
],
"scenes": [
{
"id": 0,
"name": "Scene Name",
"photo_ids": [0, 1, 2],
"overall_mood": "..."
}
],
"suggested_narrative_arc": "A 3-5 sentence description of ONE unified story that flows through ALL photos as a single continuous journey. Describe the visual and emotional thread that connects every image."
}
"""


# ── Stage 2: Script Generation Prompt ─────────────────────────────────────────

def build_script_prompt(
    scene_analysis_json: str,
    theme: str = "auto",
    duration_target: int = 30,
    num_photos: int = 5,
) -> str:
    theme_instruction = (
        f'User-selected theme: "{theme}". Tailor the mood, pacing, and visual style to this theme.'
        if theme != "auto"
        else "Auto-detect the best cinematic theme from the photos."
    )

    # Compute per-clip budget
    clip_duration = max(5, min(8, duration_target // max(num_photos, 1)))

    return f"""You are an award-winning short film director who specializes in creating
ONE UNIFIED cinematic experience from a collection of photos. You must treat ALL
{num_photos} photos as interconnected moments in a SINGLE continuous story — NOT as
separate independent scenes.

Scene Analysis:
{scene_analysis_json}

Theme Direction: {theme_instruction}

━━━ YOUR CORE MISSION ━━━
Create a SINGLE UNIFIED SCENE that weaves ALL {num_photos} photos into one flowing
cinematic journey. The viewer should feel like they are watching ONE continuous film,
not a slideshow of separate clips. Find the visual and emotional thread that connects
every photo and build your narrative around it.

━━━ HOW VIDEO GENERATION WORKS ━━━
For EACH photo you will create ONE clip. The pipeline will:
  1. Take that photo as the starting frame / visual anchor.
  2. Send your veo_prompt + that photo to Veo (image-to-video AI).
  3. Veo generates a {clip_duration}-second video clip starting from the photo,
     applying the camera motion, mood, and action you describe.
  4. All clips are then stitched together with smooth crossfade transitions,
     producing one continuous short film.

You MUST create exactly {num_photos} clip(s) — one for EVERY photo (IDs 0 through {num_photos - 1}).
Order them to create the smoothest, most natural narrative flow.

━━━ UNIFIED SCENE — CRITICAL RULES ━━━
• ALL clips are part of ONE story. They are NOT separate scenes — they are
  consecutive moments within a single continuous narrative journey.
• VISUAL BRIDGES: Each clip's veo_prompt must describe motion that visually
  connects to the next clip. Think about what elements the clips share:
  - Similar colors, textures, or lighting that carry across clips
  - Camera motion that ends pointing toward what the next photo shows
  - Shared mood and atmosphere that creates a seamless emotional flow
  - Environmental sounds that blend from one clip into the next
• CONTINUOUS MOTION: Design camera movements as one unbroken journey:
  - Clip 1 camera pushes forward → Clip 2 continues forward motion from new angle
  - Clip 3 slowly pans right → Clip 4 picks up from a similar rightward drift
  - Avoid jarring direction changes between consecutive clips
• CONSISTENT ATMOSPHERE: ALL clips must share the same:
  - Color temperature (warm/cool/neutral — pick ONE for the whole film)
  - Lighting quality (soft/hard/diffused — consistent throughout)
  - Energy level (gradually build or maintain — never randomly jump)
  - Audio texture (environmental sounds should flow as one soundscape)
• TRANSITIONS: Prefer smooth crossfades between clips. Use harder transitions
  sparingly and only for intentional dramatic effect:
    crossfade — smooth blend (DEFAULT — use for most transitions)
    fade — gentle fade through black (for significant time/space shifts)
    match_cut — when two photos share similar visual shapes/composition
    zoom_through — zoom into a detail that connects to next photo
    whip_pan — only for high-energy moments
    cut — only for sudden dramatic reveals
  The LAST clip's transition_to_next should be "fade" (ending).

━━━ MUSIC & AUDIO ━━━
• Write ONE global music_direction — a single continuous score for the whole film.
  The music should feel like one unbroken piece, not separate tracks per clip.
• Each clip's audio_mood describes the ambient layer for that moment, but they
  must all fit within the SAME soundscape. Think of it as one continuous
  environmental recording that evolves gradually.
• The final film should sound like you're moving through ONE space/experience.

━━━ OUTPUT FORMAT ━━━
Output as JSON with this EXACT schema:
{{
  "title": "Film Title (evocative, 2-5 words)",
  "overall_mood": "The single unified mood of this film",
  "music_direction": "One continuous musical score — describe the single piece of music that plays from start to finish, how it evolves, its instruments and emotional arc.",
  "narrative_summary": "3-5 sentences describing the ONE story this film tells. This is a single journey — beginning, middle, end — flowing through all {num_photos} photos as interconnected moments.",
  "clips": [
    {{
      "clip_number": 1,
      "key_photo_id": 0,
      "veo_prompt": "[Describe smooth cinematic motion starting from this photo. Include how the motion/mood/visuals connect to the next clip. Describe ambient sound that blends with the overall soundscape.]",
      "duration_seconds": {clip_duration},
      "transition_to_next": "crossfade",
      "audio_mood": "[ambient sounds that blend seamlessly with previous and next clips]",
      "narration": "Optional evocative caption, max 10 words",
      "scene_description": "How this moment connects to the overall unified story"
    }}
  ]
}}

IMPORTANT RULES:
1. You MUST include exactly {num_photos} clips — one per photo (IDs 0 through {num_photos - 1}).
2. key_photo_id must be unique per clip — each photo is used exactly once.
3. Every veo_prompt MUST describe CINEMATIC MOTION that flows into the next clip:
   ✓ "Camera glides forward through the golden-lit corridor, warm tones deepening as ambient piano echoes softly. The movement drifts toward the window light, carrying the viewer's gaze into the brightness that will open the next moment."
   ✗ "A photo of a building" (static, disconnected — useless)
4. VISUAL CONTINUITY in every veo_prompt — mention how the ending of this clip
   connects visually to what comes next (shared light, color, direction, mood).
5. Include specific audio/foley that blends across clips (shared ambient sounds).
6. Default to "crossfade" transitions — they create the smoothest flow.
7. The last clip's transition_to_next MUST be "fade".

⚠️ VEO SAFETY — CRITICAL:
- NEVER mention real people's names in veo_prompt.
- Use generic descriptors: "the subject", "the figure", "the person", etc.
- Veo WILL REJECT prompts containing real names or celebrity likenesses.
"""


# ── Veo Prompt Enhancement ────────────────────────────────────────────────────

def enhance_veo_prompt(base_prompt: str, audio_mood: str = "") -> str:
    """Add quality modifiers — emphasize smooth flow and visual continuity."""
    suffix = (
        " Smooth continuous motion, natural lighting, professional quality, "
        "fluid camera movement, seamless temporal consistency. "
        "The motion should feel like part of one continuous unbroken shot."
    )
    if audio_mood:
        suffix += f" Audio mood: {audio_mood}."
    return base_prompt.strip() + suffix


def sanitize_veo_prompt(prompt: str) -> str:
    """Remove real names and celebrity references that trigger Veo's RAI filter.

    This is a best-effort fallback — the script prompt already instructs the LLM
    not to include names, but if it slips through, we strip them here.
    """
    import re

    # ── Step 1: Protect known multi-word place names from being stripped ──
    # We temporarily replace them with placeholders, then restore after.
    _PLACE_NAMES = [
        # Bridges & landmarks
        "Golden Gate Bridge", "Brooklyn Bridge", "Tower Bridge", "London Bridge",
        "Statue of Liberty", "Eiffel Tower", "Empire State Building",
        "Times Square", "Central Park", "Hyde Park", "Golden Gate",
        "Wall Street", "Fifth Avenue", "Bourbon Street", "Hollywood Boulevard",
        # Cities & areas
        "New York", "Los Angeles", "San Francisco", "San Diego", "San Antonio",
        "San Jose", "Las Vegas", "New Orleans", "Hong Kong", "Rio de Janeiro",
        "Buenos Aires", "Kuala Lumpur", "Tel Aviv", "Ho Chi Minh",
        "Salt Lake City", "Mexico City", "New Delhi", "Cape Town",
        "Sao Paulo", "Santa Monica", "Beverly Hills", "Silicon Valley",
    ]
    placeholders: dict[str, str] = {}
    for i, place in enumerate(_PLACE_NAMES):
        tag = f"__PLACE_{i}__"
        if place in prompt:
            prompt = prompt.replace(place, tag)
            placeholders[tag] = place

    # ── Step 2: Strip names ───────────────────────────────────────────────
    # Remove capitalized proper-noun sequences (likely names)
    titles = r"(?:(?:Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Lady|King|Queen|Prince|Princess)\.?\s+)"
    # Multi-word names: "John Smith", "Mary Jane Watson"
    name_pattern = rf"\b{titles}?(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b"
    prompt = re.sub(name_pattern, "the subject", prompt)

    # Title + single name: "Dr. Chen", "Mr. Davis"
    prompt = re.sub(rf"\b{titles}[A-Z][a-z]+\b", "the subject", prompt)

    # Remove single capitalized words that are likely first names in context
    # "follows Sarah as she" → "follows the subject as she"
    # But preserve common cinematic words that happen to be capitalized at sentence start
    safe_words = {
        # Camera / cinematic terms
        "Camera", "The", "A", "An", "Slow", "Fast", "Gentle", "Soft", "Warm",
        "Cool", "Golden", "Silver", "Dark", "Light", "Deep", "Wide", "Close",
        "Low", "High", "Long", "Short", "Full", "Open", "Aerial", "Cinematic",
        "Audio", "Ambient", "Natural", "Dramatic", "Romantic", "Nostalgic",
        "Dolly", "Tracking", "Crane", "Pan", "Tilt", "Zoom", "Fade",
        "Morning", "Evening", "Night", "Day", "Sunset", "Sunrise",
        # Directions and geography
        "North", "South", "East", "West",
        "New", "San", "Los", "Las", "Old", "Grand", "Great", "Big",
        "Central", "Upper", "Lower", "Downtown", "Midtown",
        # Common place-name words
        "City", "Park", "Bridge", "Gate", "Bay", "River", "Lake", "Mountain",
        "Beach", "Ocean", "Sea", "Island", "Valley", "Hill", "Square",
        "Street", "Avenue", "Boulevard", "Road", "Harbor", "Garden",
        "Tower", "Castle", "Palace", "Church", "Temple", "Museum",
        "Station", "Airport", "Market", "District", "Heights",
        "York", "Angeles", "Francisco", "Diego", "Antonio", "Jose",
        "Hollywood", "Manhattan", "Brooklyn", "Chicago", "London",
        "Paris", "Tokyo", "Rome", "Venice", "Florence", "Milan",
        # Common mid-sentence adjectives that may be capitalized
        "Beautiful", "Bright", "Brilliant", "Calm", "Quiet", "Loud",
        "Serene", "Peaceful", "Mysterious", "Ethereal", "Vibrant",
    }

    def _replace_if_name(m: re.Match) -> str:
        word = m.group(0)
        if word in safe_words:
            return word
        return "the subject"

    # Only target mid-sentence capitalized words (not at sentence start)
    prompt = re.sub(r"(?<=\s)([A-Z][a-z]{2,})(?=\s)", _replace_if_name, prompt)

    # Collapse repeated "the subject" phrases
    prompt = re.sub(r"(the subject\s*){2,}", "the subject ", prompt)

    # ── Step 3: Restore protected place names ─────────────────────────────
    for tag, place in placeholders.items():
        prompt = prompt.replace(tag, place)

    return prompt.strip()
