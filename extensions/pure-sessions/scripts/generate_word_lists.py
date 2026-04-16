#!/usr/bin/env python3
"""
Generate human-readable word lists for session ID naming.

Original: NLTK WordNet + wordfreq frequency filtering
Extended: Topic-based word lists (Sci-Fi, Space, Tech, Mythology, etc.)

Usage:
    python3 generate_word_lists.py                  # Generate all lists
    python3 generate_word_lists.py --topics         # Only topic-based lists
    python3 generate_word_lists.py --generic        # Only generic WordNet list
    python3 generate_word_lists.py --output DIR     # Output directory (default: wordlist/)
    python3 generate_word_lists.py --min-adjectives N  # Minimum adjectives (default: 100)
    python3 generate_word_lists.py --min-nouns N       # Minimum nouns (default: 300)
"""

import argparse
import os
import re
import sys
from collections import Counter
from pathlib import Path

# ============================================================================
# Topic Word Lists (curated)
# ============================================================================

TOPIC_WORDS = {
    "sci-fi": {
        "adjectives": [
            # Star Trek
            "warp", "borg", "vulcan", "klingon", "phaser", "stellar",
            "federation", "starfleet", "triton", "quantum",
            # Star Wars
            "sith", "jedi", "wookie", "mandalorian", "hutt", "droid",
            "force", "saber", "imperial", "rebel", "dark", "exile",
            # Dune
            "fremen", "atreides", "harkonnen", "sandworm", "spice",
            "muaddib", "gom", "jabbari", "ixian", "bene",
            "shai", "lisan", "usul", "naib", "sayyadina",
            # Battlestar Galactica
            "cylon", "colonial", "viper", "raptor", "caprica",
            "kobol", "picon", "tauron", "sagittaron",
            # General Sci-Fi
            "void", "android", "sentient", "stellar", "ionic",
            "dark", "hyper", "cyber", "exo", "neo", "nano",
            "xeno", "chronal", "flux", "prism", "zenith",
            "nexus", "cobalt", "argon", "plasma", "dyson",
            "pulsar", "quasar", "scalar", "sigma", "omega",
            "delta", "gamma", "proton", "photon", "neutrino",
            "cryptic", "alien", "orbital", "lunar", "solar",
            "cosmic", "galactic", "crimson", "azure", "ember",
            "phantom", "aurora", "eclipse", "zenith", "nadir",
        ],
        "nouns": [
            # Star Trek
            "warp", "phaser", "torpedo", "shuttle", "bridge",
            "holodeck", "starbase", "nebula", "wormhole",
            "tricorder", "communicator", "dilithium", "transwarp",
            "deflector", "starship", "runabout", "spacedock",
            "quasar", "phenomenon", "anomaly",
            # Star Wars
            "sith", "jedi", "lightsaber", "wookie", "droid",
            "blaster", "tie", "xwing", "ywing", "atat",
            "walker", "destroyer", "cruiser", "corvette",
            "cantina", "podracer", "holocron", "kyber",
            "beskar", "coaxium", "purgill", "lothwolf",
            "trooper", "saber", "cloner", "sith",
            "force", "padawan", "master", "knight", "sentinel",
            # Dune
            "fremen", "sandworm", "spice", "crysknife",
            "maker", "shai", "tabr", "sietch", "stilltent",
            "ornithopter", "carryall", "harvester", "hunter",
            "maula", "stun", "shigawire", "distrans",
            "prana", "bindu", "litany", "gom", "jabbari",
            "ixian", "atreides", "harkonnen", "corrino",
            "fenring", " guild", "navig", "tank", "sardaukar",
            "arrakis", "kaitain", "caladan", "geidi", "salusa",
            # Battlestar Galactica
            "cylon", "viper", "raptor", "basestar", "raider",
            "centurion", "hybrid", "toaster", "skinjob",
            "caprica", "kobol", "picon", "tauron", "aerilon",
            "sagittaron", "gemenon", "leonis", "scorpia",
            "colonial", "adama", "galactica", "pegasus",
            "fleet", "president", "commander", "colonel",
            # General Sci-Fi
            "android", "sentient", "matrix", "cypher",
            "parsec", "warp", "hyper", "void", "rift",
            "prism", "beacon", "signal", "flux", "phase",
            "clone", "replica", "drone", "probe", "satellite",
            "station", "colony", "outpost", "sector", "quadrant",
            "relay", "gate", "portal", "nexus", "vault",
            "reactor", "engine", "thruster", "gravity", "inertia",
            "torpedo", "cannon", "shield", "armor", "hull",
            "asteroid", "comet", "meteor", "pulsar", "quasar",
            "singularity", "supernova", "accretion", "nebula",
            "dilithium", "titanium", "tungsten", "cobalt",
        ],
    },
    "space": {
        "adjectives": [
            "solar", "lunar", "stellar", "cosmic", "orbital",
            "galactic", "atomic", "infrared", "ultraviolet", "zenith",
            "polar", "celestial", "planetary", "sidereal", "interstellar",
            "bright", "dark", "crimson", "azure", "golden",
            "silvery", "radiant", "vivid", "dim", "pale",
            "faint", "vast", "remote", "distant", "nearby",
            "inner", "outer", "upper", "lower", "central",
            "frozen", "molten", "gaseous", "rocky", "dense",
            "magnetic", "electric", "thermal", "sonic", "photic",
        ],
        "nouns": [
            "star", "moon", "comet", "orbit", "nebula",
            "quasar", "pulsar", "meteor", "asteroid", "galaxy",
            "cluster", "supernova", "eclipse", "solstice", "equinox",
            "zenith", "nadir", "meridian", "horizon", "cosmos",
            "plasma", "photon", "proton", "neutron", "electron",
            "neutrino", "boson", "fermion", "hadron", "muon",
            "prism", "spectrum", "wavelength", "frequency", "amplitude",
            "photon", "aurora", "corona", "chromosphere", "magnetosphere",
            "telescope", "observatory", "satellite", "probe", "rover",
            "launch", "reentry", "docking", "transit", "conjunction",
            "mercury", "venus", "mars", "jupiter", "saturn",
            "uranus", "neptune", "pluto", "ceres", "eris",
            "titan", "europa", "ganymede", "callisto", "io",
            "triton", "charon", "mimas", "enceladus", "rhea",
            "oort", "kuiper", "heliosphere", "lithosphere", "ionosphere",
            "jet", "beam", "ray", "burst", "flare",
        ],
    },
    "tech": {
        "adjectives": [
            "sharp", "quick", "swift", "rapid", "agile",
            "clean", "lean", "pure", "core", "root",
            "prime", "proto", "alpha", "beta", "stable",
            "solid", "dense", "sparse", "linear", "parallel",
            "async", "sync", "atomic", "static", "dynamic",
            "crisp", "keen", "strict", "robust", "secure",
            "fuzzy", "wild", "brute", "mega", "giga",
            "tera", "pico", "nano", "micro", "macro",
            "cyber", "digital", "neural", "logic", "binary",
        ],
        "nouns": [
            "byte", "node", "loop", "stack", "heap",
            "queue", "array", "tree", "graph", "mesh",
            "grid", "cell", "block", "chain", "ring",
            "pipe", "stream", "buffer", "cache", "index",
            "token", "badge", "scope", "frame", "slice",
            "pivot", "axis", "edge", "peak", "root",
            "fork", "spawn", "yield", "burst", "flush",
            "fetch", "merge", "patch", "stash", "rebase",
            "shader", "pixel", "vertex", "texture", "render",
            "kernel", "daemon", "socket", "thread", "mutex",
            "query", "cursor", "schema", "table", "index",
            "hash", "salt", "nonce", "cipher", "key",
            "token", "relay", "proxy", "bridge", "tunnel",
            "codec", "parser", "lexer", "ast", "ir",
            "wasm", "llvm", "jit", "gc", "vm",
            "rust", "go", "zig", "nim", "odin",
        ],
    },
    "mythology": {
        "adjectives": [
            "grim", "bold", "rune", "sage", "dire",
            "fey", "fae", "elven", "dwarven", "orcish",
            "goblin", "trollish", "draconic", "serpent", "wolfen",
            "raven", "crow", "eagle", "hawk", "falcon",
            "ashen", "iron", "bronze", "silver", "golden",
            "crimson", "azure", "jade", "amber", "obsidian",
            "holy", "sacred", "cursed", "enchanted", "ancient",
            "elder", "primeval", "primordial", "eternal", "timeless",
            "valiant", "noble", "fierce", "wily", "cunning",
            " spectral", "phantom", "wraith", "shade", "shade",
        ],
        "nouns": [
            "rune", "sage", "oracle", "mythic", "legend",
            "valkyrie", "berserker", "druid", "shaman", "warlock",
            "enchanter", "sorcerer", "alchemist", "mystic", "seer",
            "phoenix", "griffin", "dragon", "wyvern", "hydra",
            "kraken", "leviathan", "basilisk", "chimera", "manticore",
            "pegasus", "centaur", "minotaur", "sphinx", "golem",
            "troll", "ogre", "giant", "dwarf", "elf",
            "gnome", "sprite", "nymph", "fairy", "wraith",
            "throne", "crown", "scepter", "chalice", "talisman",
            "amulet", "relic", "artifact", "scroll", "grimoire",
            "forge", "anvil", "hammer", "blade", "shield",
            "arrow", "bow", "spear", "lance", "mace",
            "dungeon", "crypt", "vault", "lair", "citadel",
            "temple", "shrine", "altar", "monolith", "obelisk",
            "yggdrasil", "midgard", "asgard", "valhalla", "helheim",
            "olympus", "tartarus", "elysium", "avalon", "camelot",
            "fenrir", "thor", "odin", "loki", "freya",
            "zeus", "hera", "athena", "ares", "hermes",
            "poseidon", "hades", "artemis", "apollo", "hephaestus",
        ],
    },
}

# ============================================================================
# Generic WordNet-based generation (original approach)
# ============================================================================

def generate_generic_words(min_adjectives=100, min_nouns=300):
    """Generate word lists from NLTK WordNet filtered by wordfreq frequency."""
    try:
        import nltk
        from nltk.corpus import wordnet as wn
        from wordfreq import zipf_frequency
    except ImportError:
        print("Warning: nltk or wordfreq not available, skipping generic list", file=sys.stderr)
        return None, None

    # Download required data
    nltk.download("wordnet", quiet=True)
    nltk.download("omw-1.4", quiet=True)

    # Frequency thresholds
    MIN_FREQ = 3.0  # Common words only (zipf scale: 0-8)
    MAX_WORD_LEN = 7  # Short words for readability

    adjectives = set()
    nouns = set()

    # Collect adjectives from WordNet
    for synset in wn.all_synsets(wn.ADJ):
        for lemma in synset.lemmas():
            word = lemma.name().lower()
            if (
                len(word) <= MAX_WORD_LEN
                and word.isalpha()
                and zipf_frequency(word, "en") >= MIN_FREQ
                and "-" not in word
                and "_" not in word
            ):
                adjectives.add(word)

    # Collect nouns from WordNet
    for synset in wn.all_synsets(wn.NOUN):
        for lemma in synset.lemmas():
            word = lemma.name().lower()
            if (
                len(word) <= MAX_WORD_LEN
                and word.isalpha()
                and zipf_frequency(word, "en") >= MIN_FREQ
                and "-" not in word
                and "_" not in word
            ):
                nouns.add(word)

    # Sort for determinism
    adj_list = sorted(adjectives)
    noun_list = sorted(nouns)

    # Trim if too many (keep most common by frequency)
    if len(adj_list) > 500:
        adj_list.sort(key=lambda w: -zipf_frequency(w, "en"))
        adj_list = adj_list[:500]
        adj_list.sort()

    if len(noun_list) > 2000:
        noun_list.sort(key=lambda w: -zipf_frequency(w, "en"))
        noun_list = noun_list[:2000]
        noun_list.sort()

    return adj_list, noun_list


# ============================================================================
# Toml serialization
# ============================================================================

def write_toml(adjectives, nouns, filepath, header_comment=""):
    """Write word lists to a TOML file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    overlap = set(adjectives) & set(nouns)
    effective = len(adjectives) * len(nouns) - len(overlap) * min(len(adjectives), len(nouns))

    lines = []
    if header_comment:
        for line in header_comment.strip().split("\n"):
            lines.append(f"# {line}" if line else "#")
        lines.append("")

    lines.append(f"# Adjectives: {len(adjectives)}")
    lines.append(f"# Nouns: {len(nouns)}")
    lines.append(f"# Overlap: {len(overlap)} (words appearing in both lists)")
    lines.append(f"# Effective combinations: {effective:,}")
    lines.append("")

    lines.append("adjectives = [")
    for adj in adjectives:
        lines.append(f'  "{adj}",')
    lines.append("]")
    lines.append("")

    lines.append("nouns = [")
    for noun in nouns:
        lines.append(f'  "{noun}",')
    lines.append("]")
    lines.append("")

    with open(filepath, "w") as f:
        f.write("\n".join(lines))

    return len(adjectives), len(nouns), len(overlap), effective


# ============================================================================
# Main
# ============================================================================

def merge_topic_words(topics):
    """Merge adjectives and nouns from selected topics, deduplicating."""
    adjectives = []
    nouns = []
    seen_adj = set()
    seen_noun = set()

    for topic in topics:
        data = TOPIC_WORDS.get(topic, {})
        for adj in data.get("adjectives", []):
            adj = adj.strip().lower()
            if adj and adj not in seen_adj and adj.isalpha() and len(adj) <= 12:
                adjectives.append(adj)
                seen_adj.add(adj)
        for noun in data.get("nouns", []):
            noun = noun.strip().lower()
            if noun and noun not in seen_noun and noun.isalpha() and len(noun) <= 14:
                nouns.append(noun)
                seen_noun.add(noun)

    return sorted(adjectives), sorted(nouns)


def main():
    parser = argparse.ArgumentParser(description="Generate word lists for session naming")
    parser.add_argument("--topics", action="store_true", help="Only generate topic-based lists")
    parser.add_argument("--generic", action="store_true", help="Only generate generic WordNet list")
    parser.add_argument("--output", default=".", help="Output directory (default: current)")
    parser.add_argument("--min-adjectives", type=int, default=100, help="Minimum adjectives per list")
    parser.add_argument("--min-nouns", type=int, default=300, help="Minimum nouns per list")
    parser.add_argument("--topic-list", default="sci-fi,space,tech,mythology",
                        help="Comma-separated topics to include (default: all)")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    topics = [t.strip() for t in args.topic_list.split(",") if t.strip()]
    do_topics = not args.generic
    do_generic = not args.topics

    # --- Topic-based word lists ---
    if do_topics:
        topic_adj, topic_noun = merge_topic_words(topics)

        if len(topic_adj) < args.min_adjectives:
            print(f"Warning: Only {len(topic_adj)} topic adjectives (min: {args.min_adjectives})", file=sys.stderr)
        if len(topic_noun) < args.min_nouns:
            print(f"Warning: Only {len(topic_noun)} topic nouns (min: {args.min_nouns})", file=sys.stderr)

        topic_header = (
            f"Topic-based word lists for generating human-readable session IDs\n"
            f"Topics: {', '.join(t.title() for t in topics)}\n"
            f"Format: <adjective>-<noun> (e.g., 'warp-nebula', 'borg-rune')"
        )
        stats = write_toml(topic_adj, topic_noun, output_dir / "word_lists.toml", topic_header)
        print(f"[topics] {stats[0]} adjectives, {stats[1]} nouns, {stats[2]} overlap, {stats[3]:,} combinations")
        print(f"  -> {output_dir / 'word_lists.toml'}")

    # --- Generic WordNet word list ---
    if do_generic:
        generic_adj, generic_noun = generate_generic_words(args.min_adjectives, args.min_nouns)
        if generic_adj and generic_noun:
            generic_header = (
                "Generic word list from NLTK WordNet + wordfreq frequency filtering\n"
                "Format: <adjective>-<noun> (e.g., 'cold-lamp', 'blue-frog')"
            )
            stats = write_toml(generic_adj, generic_noun, output_dir / "word_lists_generic.toml", generic_header)
            print(f"[generic] {stats[0]} adjectives, {stats[1]} nouns, {stats[2]} overlap, {stats[3]:,} combinations")
            print(f"  -> {output_dir / 'word_lists_generic.toml'}")
        else:
            print("[generic] Skipped (nltk/wordfreq not available)")

    print("\nDone!")


if __name__ == "__main__":
    main()
