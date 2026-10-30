"""Scoring over the real 163 subjects (demo model ported to Python, pure functions).

Answers: {"chips": [{"id", "state": "take"|"love"}], "typed": ["Textiles"],
"swipes": [{"card_id", "answer": "yes"|"no"|"up"}], "subject_swipes": [{"code", "answer"}],
"pairs": [{"pair_id", "side": "a"|"b"|null}], "shown": [codes]}.
Multipliers match the demo: yes 1, no -0.5, up 2, chip take 0.4, chip love 1.
Neighbours get 0.35 of the signal. Pairs use subject_profiles z-scores.
"""
import math
import random

CHIPS = [
    {"id": "maths", "name": "Maths", "terms": ["maths", "statistics", "numbers"]},
    {"id": "english", "name": "English", "terms": ["english", "books", "writing", "novels"]},
    {"id": "biology", "name": "Biology", "terms": ["biology", "animals", "plants", "cells"]},
    {"id": "chemistry", "name": "Chemistry", "terms": ["chemistry", "reactions", "molecules"]},
    {"id": "physics", "name": "Physics", "terms": ["physics", "space", "quantum"]},
    {"id": "computing", "name": "Computing", "terms": ["coding", "programming", "computers", "data"]},
    {"id": "art", "name": "Art & Design", "terms": ["art", "design", "drawing", "painting"]},
    {"id": "history", "name": "History", "terms": ["history", "past", "ancient"]},
    {"id": "geography", "name": "Geography", "terms": ["geography", "maps", "environment", "cities"]},
    {"id": "languages", "name": "Languages", "terms": ["language", "translation", "french", "spanish", "german"]},
]
EXTRA_NAMES = ["Music", "Drama", "Dance", "Business", "Economics", "Psychology", "PE", "Media Studies",
               "Film Studies", "Sociology", "Philosophy", "Religious Studies", "Design & Technology",
               "Product Design", "Textiles", "Photography", "Graphic Design", "Food & Nutrition",
               "Further Maths", "Statistics", "Electronics", "Engineering", "Computer Science", "Law",
               "Politics", "Criminology", "Health & Social Care", "Environmental Science", "Geology", "Classics"]

# Demo decks ported; weights are keyword terms expanded over card keywords/names.
THINGS = [
    {"id": "radio", "title": "Taking apart an old radio", "scene": "desk", "terms": {"robots": .5, "engineering": .4, "physics": .2}},
    {"id": "sew", "title": "A sewing machine mid-seam", "scene": "light", "terms": {"fashion": .7, "art": .2, "textiles": .5}},
    {"id": "fossil", "title": "Brushing dirt off a fossil", "scene": "wood", "terms": {"history": .4, "geography": .4, "fossils": .6, "archaeology": .5}},
    {"id": "synth", "title": "Making a beat on a synth", "scene": "night", "terms": {"music": .7, "coding": .2, "games": .2}},
    {"id": "printer", "title": "3D-printing a part you designed", "scene": "desk", "terms": {"engineering": .5, "robots": .3, "architecture": .2, "design": .3}},
    {"id": "lamb", "title": "Bottle-feeding a lamb", "scene": "green", "terms": {"farming": .5, "animals": .4, "biology": .3, "vet": .4}},
    {"id": "seedlings", "title": "Planting out seedlings", "scene": "green", "terms": {"plants": .6, "farming": .4, "ecology": .4}},
    {"id": "edit", "title": "Editing a video late at night", "scene": "night", "terms": {"film": .7, "journalism": .2, "games": .2, "editing": .5}},
    {"id": "paint", "title": "Mixing paint for a big canvas", "scene": "light", "terms": {"art": .7, "painting": .6, "fashion": .2}},
    {"id": "cook", "title": "Cooking for a full table", "scene": "wood", "terms": {"food": .5, "cooking": .5, "business": .2}},
    {"id": "bridge", "title": "Building a model bridge", "scene": "desk", "terms": {"engineering": .5, "bridges": .6, "architecture": .4}},
    {"id": "ankle", "title": "Strapping up a twisted ankle", "scene": "light", "terms": {"sport": .5, "nursing": .4, "physio": .6, "injury": .5}},
    {"id": "code", "title": "Coding a game from scratch", "scene": "dark", "terms": {"games": .5, "coding": .5, "gaming": .5}},
    {"id": "rockpool", "title": "Rock-pooling at low tide", "scene": "sea", "terms": {"animals": .4, "wildlife": .5, "environment": .3, "coasts": .5}},
    {"id": "gig", "title": "Rigging the lights for a gig", "scene": "night", "terms": {"events": .4, "acting": .3, "music": .3, "theatre": .4}},
    {"id": "chart", "title": "Turning messy data into a chart", "scene": "light", "terms": {"statistics": .5, "data": .4, "economics": .4, "maths": .3}},
    {"id": "club", "title": "Running a kids' football club", "scene": "green", "terms": {"sport": .4, "children": .4, "teaching": .4, "coaching": .5}},
    {"id": "rover", "title": "Driving a rover across a sand pit", "scene": "desk", "terms": {"robots": .6, "engineering": .2, "space": .4}},
]
QUESTIONS = [
    {"id": "dream", "title": "Why do we dream?", "scene": "night", "fact": "Most vivid dreams happen in REM sleep, when your brain is almost as active as when you're awake.", "terms": {"psychology": .7, "brain": .5, "biology": .3}},
    {"id": "deep", "title": "What's at the bottom of the ocean?", "scene": "sea", "fact": "Most of the ocean floor has never been mapped in detail.", "terms": {"ships": .3, "coasts": .5, "animals": .3, "earthquakes": .4}},
    {"id": "life", "title": "Is there life on other planets?", "scene": "dark", "fact": "Astronomers have confirmed more than 5,000 planets orbiting other stars.", "terms": {"space": .7, "planets": .6, "biology": .2}},
    {"id": "crime", "title": "Who decides what counts as a crime?", "scene": "wood", "fact": "The age of criminal responsibility is 10 in England and Wales, and 12 in Scotland.", "terms": {"law": .6, "crime": .6, "politics": .3, "psychology": .2}},
    {"id": "romans", "title": "What did people eat 2,000 years ago?", "scene": "wood", "fact": "Romans splashed a fermented fish sauce called garum on their food, a bit like ketchup.", "terms": {"history": .7, "ancient": .6, "food": .3}},
    {"id": "rich", "title": "Why are some countries rich and others poor?", "scene": "light", "fact": "The 2024 Nobel Prize in economics went to research on exactly this question.", "terms": {"economics": .6, "money": .4, "politics": .4, "poverty": .5}},
    {"id": "virus", "title": "How does a virus spread?", "scene": "light", "fact": "A single sneeze can send droplets several metres across a room.", "terms": {"biology": .5, "viruses": .7, "nursing": .3, "disease": .5}},
    {"id": "aiart", "title": "Can a computer be creative?", "scene": "dark", "fact": "In 2018 a portrait made by an AI sold at Christie's for $432,500.", "terms": {"ai": .6, "art": .3, "games": .3, "coding": .4}},
    {"id": "words", "title": "Why do languages change?", "scene": "wood", "fact": "In medieval English, \"nice\" meant foolish.", "terms": {"language": .6, "history": .4, "teaching": .2, "accents": .5}},
    {"id": "catchy", "title": "What makes a song catchy?", "scene": "night", "fact": "Researchers call a song stuck in your head an \"earworm\", and study why it happens.", "terms": {"music": .6, "psychology": .4, "songwriting": .5}},
    {"id": "city", "title": "How do you design a city people love?", "scene": "night", "fact": "Manhattan's street grid was planned in 1811, long before most of it was built.", "terms": {"cities": .6, "planning": .5, "architecture": .3, "urban": .5}},
    {"id": "rules", "title": "Is it ever right to break a rule?", "scene": "wood", "fact": "Philosophers have argued over the \"trolley problem\" since 1967.", "terms": {"law": .4, "ethics": .6, "politics": .3, "philosophy": .6}},
    {"id": "bees", "title": "How do bees find their way home?", "scene": "green", "fact": "Honeybees tell each other where food is by doing a \"waggle dance\".", "terms": {"ecology": .5, "wildlife": .5, "biology": .4, "animals": .3}},
    {"id": "quake", "title": "What keeps a skyscraper up in an earthquake?", "scene": "dark", "fact": "Some skyscrapers hide giant swinging weights inside to stop them swaying.", "terms": {"engineering": .6, "structures": .6, "architecture": .3, "earthquakes": .6}},
    {"id": "fake", "title": "Why do people believe fake news?", "scene": "light", "fact": "A 2018 MIT study found false news spread faster on Twitter than true news.", "terms": {"psychology": .4, "journalism": .5, "news": .5, "media": .4}},
    {"id": "species", "title": "Can we save a species on the brink?", "scene": "sea", "fact": "Humpback whales were hunted close to extinction. Many populations have since recovered.", "terms": {"ecology": .5, "conservation": .6, "wildlife": .5, "biology": .2}},
]
DECKS = {c["id"]: c for c in THINGS + QUESTIONS}
MULT = {"yes": 1.0, "no": -0.5, "up": 2.0}


def _tokens(card):
    text = (card["display_name"] + " " + card["name"] + " " + " ".join(card["keywords"])).lower()
    return text


def expand_terms(term_weights, cards):
    """Keyword-term weights -> {subject_code: weight} (strongest term match per subject)."""
    out = {}
    for card in cards:
        text = _tokens(card)
        total = sum(w for term, w in term_weights.items() if term.lower() in text)
        if total > 0:
            out[card["code"]] = min(total, 0.9)
    return out


def chip_weights(chip, cards):
    return expand_terms({t: 0.6 for t in chip["terms"]}, cards)


def _apply(state, cards_by_code, weights, mult, label):
    score, unc, direct, contrib = state
    for code, wt in weights.items():
        if code not in cards_by_code:
            continue
        d = wt * mult
        score[code] += d
        unc[code] *= (1 - 0.6 * wt * min(1, abs(mult)))
        if mult > 0:
            direct[code] += wt
            contrib[code][label] = contrib[code].get(label, 0) + d
        for nb in cards_by_code[code].get("neighbours", []):
            if nb in score:
                score[nb] += d * 0.35
                unc[nb] *= (1 - 0.2 * wt)


def _zscores(profiles):
    measures = set()
    for p in profiles.values():
        measures.update(k for k, v in p.items() if isinstance(v, (int, float)))
    stats = {}
    for m in measures:
        vals = [p[m] for p in profiles.values() if isinstance(p.get(m), (int, float))]
        mean = sum(vals) / len(vals)
        var = sum((v - mean) ** 2 for v in vals) / len(vals)
        stats[m] = (mean, math.sqrt(var) or 1.0)
    return stats


def score_answers(answers, cards, profiles, pairs_data):
    """Pure: answers + datasets -> ranked subjects with reasons. No I/O, no randomness."""
    by_code = {c["code"]: c for c in cards}
    score = {c["code"]: 0.0 for c in cards}
    unc = {c["code"]: 1.0 for c in cards}
    direct = {c["code"]: 0.0 for c in cards}
    contrib = {c["code"]: {} for c in cards}
    state = (score, unc, direct, contrib)
    chips = {c["id"]: c for c in CHIPS}
    for pick in answers.get("chips", []):
        chip = chips.get(pick.get("id"))
        if chip:
            _apply(state, by_code, chip_weights(chip, cards),
                   1.0 if pick.get("state") == "love" else 0.4, chip["name"])
    for name in answers.get("typed", []):
        w = expand_terms({name.lower(): 0.6}, cards)
        if w:
            _apply(state, by_code, w, 0.4, name)
    for swipe in answers.get("swipes", []):
        card = DECKS.get(swipe.get("card_id"))
        if card and swipe.get("answer") in MULT:
            _apply(state, by_code, expand_terms(card["terms"], cards),
                   MULT[swipe["answer"]], card["title"])
    for swipe in answers.get("subject_swipes", []):
        code = swipe.get("code")
        if code in by_code and swipe.get("answer") in MULT:
            _apply(state, by_code, {code: 1.0}, MULT[swipe["answer"]], by_code[code]["display_name"])
    pairs = {p["id"]: p for p in pairs_data.get("pairs", [])}
    stats = _zscores(profiles)
    user_vec = {}
    pair_labels = {}
    for pick in answers.get("pairs", []):
        pair = pairs.get(pick.get("pair_id"))
        side = pick.get("side")
        if not pair or side not in ("a", "b"):
            continue
        for measure, v in pair[side].get("scores", {}).items():
            user_vec[measure] = user_vec.get(measure, 0) + v
            pair_labels[measure] = pair[side]["label"]
    if user_vec:
        for code, prof in profiles.items():
            if code not in score:
                continue
            total = sum(user_vec[m] * (prof[m] - stats[m][0]) / stats[m][1]
                        for m in user_vec if isinstance(prof.get(m), (int, float)) and m in stats)
            if total:
                score[code] += total * 0.35
                unc[code] *= 0.9
                top = max(user_vec, key=lambda m: abs(user_vec[m]))
                if total > 0:
                    contrib[code][pair_labels[top]] = contrib[code].get(pair_labels[top], 0) + total * 0.35
    ranked = sorted(
        ({"code": c["code"], "display_name": c["display_name"], "score": round(score[c["code"]], 3),
          "uncertainty": round(unc[c["code"]], 3), "direct": round(direct[c["code"]], 3),
          "reasons": [k for k, _ in sorted(contrib[c["code"]].items(), key=lambda kv: -kv[1])[:2]]}
         for c in cards), key=lambda r: -r["score"])
    surprise = next((r["code"] for r in ranked if r["score"] > 0.3 and r["direct"] < 0.15), None)
    room = [r["code"] for r in ranked if r["score"] > 0.15][:8]
    return {"ranked": ranked, "surprise": surprise, "room": room}


def pick_next_cards(answers, cards, profiles, pairs_data, shown, count=5, seed=0):
    """Thompson-style: sample score/uncertainty, every 4th pick explores unseen high-uncertainty."""
    result = score_answers(answers, cards, profiles, pairs_data)
    by_code = {c["code"]: c for c in cards}
    info = {r["code"]: r for r in result["ranked"]}
    unseen = [c["code"] for c in cards if c["code"] not in set(shown)]
    rng = random.Random(seed)
    sampled = sorted(unseen, key=lambda code: -(info[code]["score"] + rng.gauss(0, info[code]["uncertainty"] * 0.5)))
    picked = []
    for i in range(min(count, len(sampled))):
        if i % 4 == 3:
            pool = [c for c in unseen if c not in picked]
            pick = max(pool, key=lambda c: info[c]["uncertainty"]) if pool else sampled[i]
        else:
            pick = next(c for c in sampled if c not in picked)
        picked.append(pick)
    return [{**by_code[c], "score": info[c]["score"], "uncertainty": info[c]["uncertainty"]} for c in picked]
