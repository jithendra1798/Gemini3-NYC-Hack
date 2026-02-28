"""Gemini prompt templates for CineSnap pipeline stages."""

# ── Stage 1: Scene Analysis Prompt ────────────────────────────────────────────

ANALYSIS_PROMPT = """You are a professional Cinematographer and Technical Director. Your goal is to analyze the provided photo collection and generate a production-ready JSON manifest that drives an AI video generation pipeline (Images → LLM → Script/Key Frame → Video).

For each photo, extract and generate production-level data:

    location_type: (Indoor/Outdoor + specific setting like "urban residential street").

    time_of_day: (Morning, afternoon, golden_hour, evening, night).

    weather: (Detailed atmospheric conditions and their visual effect).

    mood: (Descriptive tone, e.g., "Isolated and stagnant").

    subjects: (Crucial: Describe the environment from the photo and introduce a "Main Figure" or protagonist to provide a narrative anchor for the video).

    key_details: (A highly detailed "Key Picture" prompt for image generators. Include lighting quality, film stock like "35mm", textures, and color palette).

    energy_level: (Low, medium, or high — this will dictate the motion speed and temporal consistency of the video).

    suggested_camera_movement: (A technical video script. Include specific camera physics, start/end frames, and a description of the audio/foley layer).

Then, group the photos into SCENES. Photos in the same scene share a similar environment and thematic connection.

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
"suggested_narrative_arc": "A brief description of the recommended story flow connecting these scenes into a cohesive short film clip."
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

    return f"""You are an award-winning short film director. Given the following scene analysis from
a photo collection, write a cinematic script that turns these moments into a
compelling short film (~{duration_target} seconds).

Scene Analysis:
{scene_analysis_json}

Theme Direction: {theme_instruction}

━━━ HOW VIDEO GENERATION WORKS ━━━
For EACH clip you write, we will:
  1. Take the KEY PHOTO you pick as the starting frame / visual anchor.
  2. Send your veo_prompt + that photo to Veo (image-to-video AI).
  3. Veo generates an 8-second video clip that starts from that photo and
     applies the camera motion, mood, and action you describe.

So your veo_prompt must describe MOTION STARTING FROM the key photo:
  ✓ "Camera slowly pulls back from the subject's face revealing the cityscape behind them, golden hour light sweeping across the buildings"
  ✗ "A photo of a person in front of a city" (this is static — useless)

━━━ OUTPUT FORMAT ━━━
For each clip, specify:
- clip_number: sequential integer starting from 1
- key_photo_id: the photo ID (from the analysis) that best represents this moment.
  This photo becomes the starting frame for video generation.
  EVERY photo should be used as a key_photo_id in exactly one clip. You have {num_photos} photos.
- veo_prompt: A rich, cinematic prompt describing the VIDEO MOTION that Veo
  should generate starting from the key photo. Include:
  • Camera movement (slow pan, dolly out, tracking shot, crane up, etc.)
  • Action / motion in the scene (wind blowing, people walking, waves crashing)
  • Lighting and atmosphere changes
  • Cinematic style (shallow DOF, film grain, anamorphic, color palette)
  • Audio direction (ambient sounds, music feel — Veo generates native audio)
- duration_seconds: always 8 (Veo default clip length)
- transition_to_next: one of: "crossfade", "cut", "zoom_through", "match_cut", "whip_pan", "wipe", "fade"
- audio_mood: what the audio/music should feel like during this clip
- narration: optional brief voice-over or text overlay (keep it evocative, max 10 words)
- scene_description: 1-2 sentence human-readable description of what this clip shows

IMPORTANT RULES:
1. Use EVERY uploaded photo exactly once as a key_photo_id. You have {num_photos} photos (IDs 0 through {num_photos - 1}).
2. Order the clips to tell a coherent narrative — it doesn't have to follow photo order.
3. The veo_prompt must describe CINEMATIC MOTION, not a static scene.
4. Include audio direction in the veo_prompt (Veo 3.1 generates native audio).
5. Vary pacing: mix slow contemplative clips with dynamic energetic ones.
6. Total clips = {num_photos} (one per photo).

⚠️ VEO SAFETY — CRITICAL:
- NEVER mention real people's names in veo_prompt (e.g. no "John", "Taylor Swift", etc.)
- NEVER reference celebrities, public figures, or named individuals.
- Use generic descriptors instead: "the subject", "the figure", "the person",
  "the woman", "the man", "the group", "the couple", "the child", etc.
- Veo WILL REJECT any prompt containing real names or celebrity likenesses.
- This rule applies ONLY to veo_prompt. The narration and scene_description
  fields can use descriptive language freely.

Output as JSON with this exact schema:
{{
  "title": "Film Title",
  "overall_mood": "dominant mood",
  "music_direction": "Description of the overall musical score — instruments, tempo, mood evolution across the film",
  "clips": [
    {{
      "clip_number": 1,
      "key_photo_id": 0,
      "veo_prompt": "Camera slowly pulls back from the subject revealing...",
      "duration_seconds": 8,
      "transition_to_next": "crossfade",
      "audio_mood": "gentle ambient warmth",
      "narration": "Where it all began...",
      "scene_description": "Opening shot starting from the beach portrait, camera reveals the sunset coastline"
    }}
  ]
}}
"""


# ── Veo Prompt Enhancement ────────────────────────────────────────────────────

def enhance_veo_prompt(base_prompt: str, audio_mood: str = "") -> str:
    """Add cinematic quality modifiers to a Veo prompt."""
    suffix = (
        " Cinematic quality, shallow depth of field, professional color grading, "
        "film grain, anamorphic lens flare."
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
