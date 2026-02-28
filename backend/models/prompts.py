"""Gemini prompt templates for CineSnap pipeline stages."""

# ── Stage 1: Scene Analysis Prompt ────────────────────────────────────────────

ANALYSIS_PROMPT = """You are a professional cinematographer analyzing a photo collection for a short film.

For each photo, extract:
- location_type: (indoor/outdoor, specific setting like "beach", "restaurant", "park")
- time_of_day: (morning, afternoon, golden_hour, evening, night)
- weather: (sunny, cloudy, rainy, overcast, clear, foggy, snowy, etc.)
- mood: (joyful, serene, dramatic, nostalgic, adventurous, romantic, melancholic, mysterious, energetic, peaceful)
- subjects: (description of people, objects, activities visible in the photo)
- key_details: (notable elements — colors, textures, landmarks, expressions, clothing)
- energy_level: (low, medium, or high — this affects pacing of the film)
- suggested_camera_movement: (slow_pan, zoom_in, zoom_out, tracking_shot, static, aerial, dolly, tilt_up, tilt_down)

Then group the photos into SCENES. Photos in the same scene share:
- Similar location/environment
- Related time period
- Thematic connection

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
  "suggested_narrative_arc": "brief description of the recommended story flow connecting these scenes"
}

Be specific and detailed — this metadata drives the entire cinematic pipeline.
"""


# ── Stage 2: Script Generation Prompt ─────────────────────────────────────────

def build_script_prompt(
    scene_analysis_json: str,
    theme: str = "auto",
    duration_target: int = 30,
) -> str:
    theme_instruction = (
        f'User-selected theme: "{theme}". Tailor the mood, pacing, and visual style to this theme.'
        if theme != "auto"
        else "Auto-detect the best cinematic theme from the photos."
    )

    return f"""You are an award-winning short film director. Given the following scene analysis from
a photo collection, write a cinematic script that weaves these moments into a
compelling short film (~{duration_target} seconds).

Scene Analysis:
{scene_analysis_json}

Theme Direction: {theme_instruction}

For each shot in the script, specify:
- shot_number: sequential integer starting from 1
- shot_type: "photo" (use existing image) or "generated" (Veo will create this)
- source_photo_id: (required if shot_type is "photo" — the id of the photo to use)
- veo_prompt: (required if shot_type is "generated" — detailed prompt for Veo 3.1 video generation.
  Describe the scene, camera movement, lighting, mood, and any audio direction.
  Be very specific and cinematic.)
- duration_seconds: 3 to 8 seconds per shot
- camera_direction: detailed camera movement description
- transition_to_next: one of: "crossfade", "cut", "zoom_through", "match_cut", "whip_pan", "wipe", "fade"
- audio_mood: what the background music/audio should feel like at this point
- narration: optional brief text overlay or voice-over line (keep it evocative and short)
- reference_photo_ids: (for "generated" shots only) list of photo IDs from the analysis
  whose visual style Veo should reference for consistency (max 3)

IMPORTANT RULES:
1. Generated shots should BRIDGE between photo-based shots — transitions, establishing shots, atmospheric moments.
2. Maintain visual continuity — reference colors, lighting, setting from adjacent photos.
3. The first and last shots should be "generated" to create a cinematic opening and closing.
4. Total duration should be approximately {duration_target} seconds.
5. Vary pacing — mix slow contemplative shots with dynamic ones based on energy_level.
6. For "photo" shots with veo_prompt, describe how to animate the photo (Ken Burns effect, slow zoom, etc.)
7. Make the veo_prompt for generated shots extremely detailed and cinematic.

Output as JSON with this exact schema:
{{
  "title": "Film Title",
  "overall_mood": "dominant mood",
  "music_direction": "Description of the overall musical score — instruments, tempo, mood shifts",
  "shots": [
    {{
      "shot_number": 1,
      "shot_type": "generated",
      "veo_prompt": "Detailed cinematic prompt...",
      "duration_seconds": 5,
      "camera_direction": "Camera movement description",
      "transition_to_next": "crossfade",
      "audio_mood": "mood description",
      "narration": "Optional text",
      "reference_photo_ids": [0, 1]
    }},
    {{
      "shot_number": 2,
      "shot_type": "photo",
      "source_photo_id": 0,
      "veo_prompt": "Slow Ken Burns zoom into the subject, gentle motion...",
      "duration_seconds": 4,
      "camera_direction": "Slow zoom in",
      "transition_to_next": "match_cut",
      "audio_mood": "warm emotional",
      "narration": null,
      "reference_photo_ids": []
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
