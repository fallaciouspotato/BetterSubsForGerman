"""
tools/generate_dictionary.py

Generates a comprehensive foundational German-English dictionary and form->lemma mapping
covering high-frequency vocabulary (children's shows, daily life, conversation, A1-B1 vocabulary).
Auto-expands regular verb conjugations, noun plurals, and adjective declensions.
"""

import json
import os

# 1. Base Lemmas with Part of Speech and English Glosses
LEXICON = {
    # --- Peppa & Kids Shows / Daily Fun ---
    "pfütze": ("noun", ["puddle"]),
    "matsch": ("noun", ["mud", "slush"]),
    "schlamm": ("noun", ["mud", "sludge"]),
    "stiefel": ("noun", ["boot", "boots"]),
    "gummistiefel": ("noun", ["rubber boots", "wellington boots"]),
    "schwein": ("noun", ["pig", "swine"]),
    "ferkel": ("noun", ["piglet"]),
    "mama": ("noun", ["mom", "mummy"]),
    "papa": ("noun", ["dad", "daddy"]),
    "bruder": ("noun", ["brother"]),
    "schwester": ("noun", ["sister"]),
    "oma": ("noun", ["grandma", "granny"]),
    "opa": ("noun", ["grandpa"]),
    "dinosaurier": ("noun", ["dinosaur"]),
    "dino": ("noun", ["dino"]),
    "teddy": ("noun", ["teddy bear"]),
    "spielzeug": ("noun", ["toy"]),
    "schaukel": ("noun", ["swing"]),
    "rutsche": ("noun", ["slide"]),
    "spielplatz": ("noun", ["playground"]),
    "regen": ("noun", ["rain"]),
    "sonne": ("noun", ["sun"]),
    "wolke": ("noun", ["cloud"]),
    "wind": ("noun", ["wind"]),
    "wetter": ("noun", ["weather"]),
    "baum": ("noun", ["tree"]),
    "blume": ("noun", ["flower"]),
    "gras": ("noun", ["grass"]),
    "garten": ("noun", ["garden"]),
    "haus": ("noun", ["house", "home"]),
    "zimmer": ("noun", ["room"]),
    "küche": ("noun", ["kitchen"]),
    "bett": ("noun", ["bed"]),
    "tisch": ("noun", ["table"]),
    "stuhl": ("noun", ["chair"]),
    "auto": ("noun", ["car"]),
    "bus": ("noun", ["bus"]),
    "zug": ("noun", ["train"]),
    "fahrrad": ("noun", ["bicycle", "bike"]),
    "ball": ("noun", ["ball"]),
    "spiel": ("noun", ["game", "play"]),
    "buch": ("noun", ["book"]),
    "geschichte": ("noun", ["story", "history"]),
    "musik": ("noun", ["music"]),
    "lied": ("noun", ["song"]),
    "spass": ("noun", ["fun", "pleasure"]),
    "spaß": ("noun", ["fun", "pleasure"]),
    "freude": ("noun", ["joy", "delight"]),
    "freund": ("noun", ["friend", "boyfriend"]),
    "freundin": ("noun", ["friend", "girlfriend"]),
    "freundschaft": ("noun", ["friendship"]),
    "tier": ("noun", ["animal"]),
    "hund": ("noun", ["dog"]),
    "katze": ("noun", ["cat"]),
    "vogel": ("noun", ["bird"]),
    "ente": ("noun", ["duck"]),
    "frosch": ("noun", ["frog"]),
    "hase": ("noun", ["rabbit", "hare"]),
    "kaninchen": ("noun", ["rabbit", "bunny"]),
    "pferd": ("noun", ["horse"]),
    "pony": ("noun", ["pony"]),
    "kuh": ("noun", ["cow"]),
    "schaf": ("noun", ["sheep"]),
    "ziege": ("noun", ["goat"]),
    "huhn": ("noun", ["chicken", "hen"]),
    "fisch": ("noun", ["fish"]),
    "elefant": ("noun", ["elephant"]),
    "löwe": ("noun", ["lion"]),
    "krokodil": ("noun", ["crocodile"]),
    "affe": ("noun", ["monkey"]),
    "bär": ("noun", ["bear"]),
    "maus": ("noun", ["mouse"]),
    "picknick": ("noun", ["picnic"]),
    "kuchen": ("noun", ["cake"]),
    "keks": ("noun", ["cookie", "biscuit"]),
    "apfel": ("noun", ["apple"]),
    "banane": ("noun", ["banana"]),
    "brot": ("noun", ["bread"]),
    "brötchen": ("noun", ["bread roll"]),
    "käse": ("noun", ["cheese"]),
    "milch": ("noun", ["milk"]),
    "wasser": ("noun", ["water"]),
    "saft": ("noun", ["juice"]),
    "eis": ("noun", ["ice cream", "ice"]),
    "schokolade": ("noun", ["chocolate"]),
    "frühstück": ("noun", ["breakfast"]),
    "mittagessen": ("noun", ["lunch"]),
    "abendessen": ("noun", ["dinner", "supper"]),
    "brille": ("noun", ["glasses", "spectacles"]),
    "uhr": ("noun", ["clock", "watch", "hour"]),
    "hut": ("noun", ["hat"]),
    "mütze": ("noun", ["cap", "beanie"]),
    "jacke": ("noun", ["jacket"]),
    "mantel": ("noun", ["coat"]),
    "hose": ("noun", ["pants", "trousers"]),
    "kleid": ("noun", ["dress"]),
    "schuh": ("noun", ["shoe"]),
    "socke": ("noun", ["sock"]),
    "t-shirt": ("noun", ["t-shirt"]),
    "tasche": ("noun", ["bag", "pocket"]),
    "rucksack": ("noun", ["backpack"]),
    "arzt": ("noun", ["doctor"]),
    "zahnarzt": ("noun", ["dentist"]),
    "lehrer": ("noun", ["teacher"]),
    "lehrerin": ("noun", ["female teacher"]),
    "schule": ("noun", ["school"]),
    "kindergarten": ("noun", ["kindergarten", "nursery"]),
    "krankenhaus": ("noun", ["hospital"]),
    "urlaub": ("noun", ["vacation", "holiday"]),
    "strand": ("noun", ["beach"]),
    "meer": ("noun", ["sea", "ocean"]),
    "see": ("noun", ["lake"]),
    "fluss": ("noun", ["river"]),
    "berg": ("noun", ["mountain"]),
    "wald": ("noun", ["forest", "woods"]),
    "stadt": ("noun", ["city", "town"]),
    "dorf": ("noun", ["village"]),
    "straße": ("noun", ["street", "road"]),
    "weg": ("noun", ["path", "way"]),
    "brücke": ("noun", ["bridge"]),
    "post": ("noun", ["mail", "post office"]),
    "brief": ("noun", ["letter"]),
    "paket": ("noun", ["package", "parcel"]),
    "geschenk": ("noun", ["gift", "present"]),
    "geburtstag": ("noun", ["birthday"]),
    "weihnachten": ("noun", ["Christmas"]),
    "ostern": ("noun", ["Easter"]),
    "party": ("noun", ["party"]),
    "fest": ("noun", ["festival", "party", "celebration"]),

    # --- People, Body, Mind ---
    "mensch": ("noun", ["human", "person"]),
    "leute": ("noun", ["people"]),
    "mann": ("noun", ["man", "husband"]),
    "frau": ("noun", ["woman", "wife", "Mrs."]),
    "kind": ("noun", ["child", "kid"]),
    "baby": ("noun", ["baby"]),
    "junge": ("noun", ["boy"]),
    "mädchen": ("noun", ["girl"]),
    "eltern": ("noun", ["parents"]),
    "familie": ("noun", ["family"]),
    "sohn": ("noun", ["son"]),
    "tochter": ("noun", ["daughter"]),
    "onkel": ("noun", ["uncle"]),
    "tante": ("noun", ["aunt"]),
    "cousin": ("noun", ["cousin"]),
    "kopf": ("noun", ["head"]),
    "haar": ("noun", ["hair"]),
    "auge": ("noun", ["eye"]),
    "ohr": ("noun", ["ear"]),
    "nase": ("noun", ["nose"]),
    "mund": ("noun", ["mouth"]),
    "zahn": ("noun", ["tooth"]),
    "zunge": ("noun", ["tongue"]),
    "hals": ("noun", ["neck", "throat"]),
    "hand": ("noun", ["hand"]),
    "arm": ("noun", ["arm"]),
    "finger": ("noun", ["finger"]),
    "fuß": ("noun", ["foot"]),
    "bein": ("noun", ["leg"]),
    "bauch": ("noun", ["belly", "stomach", "tummy"]),
    "rücken": ("noun", ["back"]),
    "herz": ("noun", ["heart"]),
    "stimme": ("noun", ["voice"]),
    "name": ("noun", ["name"]),
    "idee": ("noun", ["idea"]),
    "problem": ("noun", ["problem"]),
    "frage": ("noun", ["question"]),
    "antwort": ("noun", ["answer"]),
    "glück": ("noun", ["luck", "happiness"]),

    # --- Time & Measures ---
    "zeit": ("noun", ["time"]),
    "tag": ("noun", ["day"]),
    "nacht": ("noun", ["night"]),
    "morgen": ("noun", ["morning"]),
    "vormittag": ("noun", ["late morning"]),
    "mittag": ("noun", ["noon", "midday"]),
    "nachmittag": ("noun", ["afternoon"]),
    "abend": ("noun", ["evening"]),
    "woche": ("noun", ["week"]),
    "monat": ("noun", ["month"]),
    "jahr": ("noun", ["year"]),
    "stunde": ("noun", ["hour"]),
    "minute": ("noun", ["minute"]),
    "sekunde": ("noun", ["second"]),
    "moment": ("noun", ["moment"]),
    "augenblick": ("noun", ["moment", "instant"]),
    "montag": ("noun", ["Monday"]),
    "dienstag": ("noun", ["Tuesday"]),
    "mittwoch": ("noun", ["Wednesday"]),
    "donnerstag": ("noun", ["Thursday"]),
    "freitag": ("noun", ["Friday"]),
    "samstag": ("noun", ["Saturday"]),
    "sonntag": ("noun", ["Sunday"]),
    "wochenende": ("noun", ["weekend"]),
    "frühling": ("noun", ["spring"]),
    "sommer": ("noun", ["summer"]),
    "herbst": ("noun", ["autumn", "fall"]),
    "winter": ("noun", ["winter"]),
    "mal": ("noun", ["time", "occurrence"]),

    # --- Verbs (Infinitives) ---
    "sein": ("verb", ["to be", "exist"]),
    "haben": ("verb", ["to have", "possess"]),
    "werden": ("verb", ["to become", "will", "grow"]),
    "können": ("verb", ["can", "to be able to"]),
    "müssen": ("verb", ["must", "to have to"]),
    "wollen": ("verb", ["to want", "intend"]),
    "sollen": ("verb", ["should", "supposed to"]),
    "dürfen": ("verb", ["may", "allowed to"]),
    "mögen": ("verb", ["to like"]),
    "möchten": ("verb", ["would like"]),
    "gehen": ("verb", ["to go", "walk"]),
    "kommen": ("verb", ["to come", "arrive"]),
    "sehen": ("verb", ["to see", "look"]),
    "schauen": ("verb", ["to look", "watch"]),
    "gucken": ("verb", ["to look", "peek"]),
    "hören": ("verb", ["to hear", "listen"]),
    "sprechen": ("verb", ["to speak", "talk"]),
    "reden": ("verb", ["to talk", "chat"]),
    "sagen": ("verb", ["to say", "tell"]),
    "erzählen": ("verb", ["to tell", "narrate"]),
    "fragen": ("verb", ["to ask"]),
    "antworten": ("verb", ["to answer", "reply"]),
    "rufen": ("verb", ["to call", "shout"]),
    "schreien": ("verb", ["to scream", "shout"]),
    "lachen": ("verb", ["to laugh"]),
    "lächeln": ("verb", ["to smile"]),
    "weinen": ("verb", ["to cry", "weep"]),
    "machen": ("verb", ["to make", "do"]),
    "tun": ("verb", ["to do"]),
    "spielen": ("verb", ["to play"]),
    "arbeiten": ("verb", ["to work"]),
    "lernen": ("verb", ["to learn", "study"]),
    "lesen": ("verb", ["to read"]),
    "schreiben": ("verb", ["to write"]),
    "malen": ("verb", ["to paint", "draw"]),
    "zeichnen": ("verb", ["to draw", "sketch"]),
    "singen": ("verb", ["to sing"]),
    "tanzen": ("verb", ["to dance"]),
    "springen": ("verb", ["to jump", "hop"]),
    "hüpfen": ("verb", ["to hop", "skip"]),
    "laufen": ("verb", ["to run", "walk"]),
    "rennen": ("verb", ["to run", "race"]),
    "schwimmen": ("verb", ["to swim"]),
    "tauchen": ("verb", ["to dive"]),
    "fliegen": ("verb", ["to fly"]),
    "fahren": ("verb", ["to drive", "ride", "travel"]),
    "reiten": ("verb", ["to ride a horse"]),
    "sitzen": ("verb", ["to sit"]),
    "stehen": ("verb", ["to stand"]),
    "liegen": ("verb", ["to lie down"]),
    "schlafen": ("verb", ["to sleep"]),
    "aufwachen": ("verb", ["to wake up"]),
    "aufstehen": ("verb", ["to get up", "stand up"]),
    "einschlafen": ("verb", ["to fall asleep"]),
    "essen": ("verb", ["to eat"]),
    "trinken": ("verb", ["to drink"]),
    "kochen": ("verb", ["to cook"]),
    "backen": ("verb", ["to bake"]),
    "frühstücken": ("verb", ["to eat breakfast"]),
    "nehmen": ("verb", ["to take"]),
    "geben": ("verb", ["to give"]),
    "bringen": ("verb", ["to bring", "carry"]),
    "holen": ("verb", ["to get", "fetch"]),
    "tragen": ("verb", ["to wear", "carry"]),
    "anziehen": ("verb", ["to put on", "dress"]),
    "ausziehen": ("verb", ["to take off", "undress"]),
    "waschen": ("verb", ["to wash"]),
    "putzen": ("verb", ["to clean", "brush"]),
    "saubermachen": ("verb", ["to clean up"]),
    "aufräumen": ("verb", ["to tidy up"]),
    "finden": ("verb", ["to find"]),
    "suchen": ("verb", ["to look for", "search"]),
    "verlieren": ("verb", ["to lose"]),
    "vergessen": ("verb", ["to forget"]),
    "erinnern": ("verb", ["to remember", "remind"]),
    "denken": ("verb", ["to think"]),
    "glauben": ("verb", ["to believe"]),
    "wissen": ("verb", ["to know"]),
    "kennen": ("verb", ["to know", "be familiar with"]),
    "verstehen": ("verb", ["to understand"]),
    "helfen": ("verb", ["to help", "assist"]),
    "brauchen": ("verb", ["to need", "require"]),
    "lieben": ("verb", ["to love"]),
    "hassen": ("verb", ["to hate"]),
    "freuen": ("verb", ["to be glad", "look forward to"]),
    "hoffen": ("verb", ["to hope"]),
    "wünschen": ("verb", ["to wish"]),
    "warten": ("verb", ["to wait"]),
    "zeigen": ("verb", ["to show", "point"]),
    "öffnen": ("verb", ["to open"]),
    "aufmachen": ("verb", ["to open"]),
    "schließen": ("verb", ["to close", "shut"]),
    "zumachen": ("verb", ["to close", "shut"]),
    "kaufen": ("verb", ["to buy"]),
    "verkaufen": ("verb", ["to sell"]),
    "bezahlen": ("verb", ["to pay"]),
    "kosten": ("verb", ["to cost"]),
    "probieren": ("verb", ["to try", "taste"]),
    "versuchen": ("verb", ["to try", "attempt"]),
    "anfangen": ("verb", ["to begin", "start"]),
    "beginnen": ("verb", ["to begin", "start"]),
    "aufhören": ("verb", ["to stop", "quit"]),
    "stoppen": ("verb", ["to stop"]),
    "halten": ("verb", ["to hold", "stop"]),
    "fallen": ("verb", ["to fall"]),
    "werfen": ("verb", ["to throw"]),
    "fangen": ("verb", ["to catch"]),
    "bauen": ("verb", ["to build"]),
    "reparieren": ("verb", ["to repair", "fix"]),
    "retten": ("verb", ["to save", "rescue"]),
    "drücken": ("verb", ["to press", "push", "hug"]),
    "ziehen": ("verb", ["to pull", "move"]),
    "schieben": ("verb", ["to push", "shove"]),
    "passen": ("verb", ["to fit", "suit"]),
    "funktionieren": ("verb", ["to work", "function"]),
    "klappen": ("verb", ["to work out", "go well"]),
    "gehören": ("verb", ["to belong to"]),
    "folgen": ("verb", ["to follow"]),
    "bleiben": ("verb", ["to stay", "remain"]),
    "wohnen": ("verb", ["to live", "reside"]),
    "leben": ("verb", ["to live"]),
    "sterben": ("verb", ["to die"]),
    "regnen": ("verb", ["to rain"]),
    "schneien": ("verb", ["to snow"]),
    "scheinen": ("verb", ["to shine", "seem"]),

    # --- Adjectives & Adverbs ---
    "gut": ("adj", ["good", "well", "fine"]),
    "besser": ("adj", ["better"]),
    "beste": ("adj", ["best"]),
    "schlecht": ("adj", ["bad", "poor"]),
    "groß": ("adj", ["big", "large", "tall"]),
    "größer": ("adj", ["bigger", "taller"]),
    "klein": ("adj", ["small", "little"]),
    "kleiner": ("adj", ["smaller"]),
    "schön": ("adj", ["beautiful", "nice", "lovely"]),
    "hässlich": ("adj", ["ugly"]),
    "neu": ("adj", ["new"]),
    "alt": ("adj", ["old"]),
    "jung": ("adj", ["young"]),
    "schnell": ("adj", ["fast", "quick"]),
    "langsam": ("adj", ["slow"]),
    "laut": ("adj", ["loud", "noisy"]),
    "leise": ("adj", ["quiet", "soft"]),
    "warm": ("adj", ["warm"]),
    "heiß": ("adj", ["hot"]),
    "kalt": ("adj", ["cold"]),
    "kühl": ("adj", ["cool"]),
    "lustig": ("adj", ["funny", "amusing"]),
    "komisch": ("adj", ["funny", "strange", "weird"]),
    "traurig": ("adj", ["sad"]),
    "fröhlich": ("adj", ["cheerful", "happy"]),
    "glücklich": ("adj", ["happy", "lucky"]),
    "müde": ("adj", ["tired", "sleepy"]),
    "wach": ("adj", ["awake"]),
    "toll": ("adj", ["great", "terrific", "awesome"]),
    "prima": ("adj", ["great", "fine"]),
    "super": ("adj", ["super", "great"]),
    "wunderbar": ("adj", ["wonderful"]),
    "fantastisch": ("adj", ["fantastic"]),
    "wichtig": ("adj", ["important"]),
    "richtig": ("adj", ["correct", "right", "real"]),
    "falsch": ("adj", ["wrong", "false"]),
    "einfach": ("adj", ["simple", "easy"]),
    "schwer": ("adj", ["heavy", "difficult", "hard"]),
    "leicht": ("adj", ["light", "easy"]),
    "stark": ("adj", ["strong"]),
    "schwach": ("adj", ["weak"]),
    "sauber": ("adj", ["clean"]),
    "schmutzig": ("adj", ["dirty"]),
    "dreckig": ("adj", ["dirty", "filthy"]),
    "matschig": ("adj", ["muddy", "slushy"]),
    "nass": ("adj", ["wet"]),
    "trocken": ("adj", ["dry"]),
    "fertig": ("adj", ["ready", "done", "finished"]),
    "bereit": ("adj", ["ready", "prepared"]),
    "voll": ("adj", ["full"]),
    "leer": ("adj", ["empty"]),
    "ganz": ("adj", ["whole", "entire", "quite"]),
    "kaputt": ("adj", ["broken"]),
    "süß": ("adj", ["sweet", "cute"]),
    "lecker": ("adj", ["delicious", "tasty"]),
    "hungrig": ("adj", ["hungry"]),
    "durstig": ("adj", ["thirsty"]),
    "bunt": ("adj", ["colorful"]),
    "rot": ("adj", ["red"]),
    "blau": ("adj", ["blue"]),
    "grün": ("adj", ["green"]),
    "gelb": ("adj", ["yellow"]),
    "orange": ("adj", ["orange"]),
    "rosa": ("adj", ["pink"]),
    "lila": ("adj", ["purple"]),
    "braun": ("adj", ["brown"]),
    "schwarz": ("adj", ["black"]),
    "weiß": ("adj", ["white"]),
    "grau": ("adj", ["grey", "gray"]),
    "hell": ("adj", ["bright", "light"]),
    "dunkel": ("adj", ["dark"]),
    "teuer": ("adj", ["expensive"]),
    "billig": ("adj", ["cheap"]),
    "nah": ("adj", ["near", "close"]),
    "weit": ("adj", ["far", "wide"]),
    "spät": ("adj", ["late"]),
    "früh": ("adj", ["early"]),

    # --- Adverbs, Particles, Function words ---
    "sehr": ("adv", ["very", "greatly"]),
    "viel": ("adv", ["much", "a lot"]),
    "viele": ("pron", ["many"]),
    "wenig": ("adv", ["little", "few"]),
    "etwas": ("pron", ["something", "a bit", "some"]),
    "nichts": ("pron", ["nothing"]),
    "alles": ("pron", ["everything", "all"]),
    "alle": ("pron", ["all", "everyone"]),
    "jeder": ("pron", ["everyone", "every"]),
    "jede": ("pron", ["everyone", "every"]),
    "jedes": ("pron", ["everyone", "every"]),
    "jemand": ("pron", ["someone", "somebody"]),
    "niemand": ("pron", ["nobody", "no one"]),
    "auch": ("adv", ["also", "too", "as well"]),
    "noch": ("adv", ["still", "yet", "another"]),
    "schon": ("adv", ["already", "yet"]),
    "immer": ("adv", ["always", "ever"]),
    "nie": ("adv", ["never"]),
    "niemals": ("adv", ["never"]),
    "oft": ("adv", ["often"]),
    "manchmal": ("adv", ["sometimes"]),
    "selten": ("adv", ["rarely", "seldom"]),
    "wieder": ("adv", ["again"]),
    "hier": ("adv", ["here"]),
    "da": ("adv", ["there", "here", "because"]),
    "dort": ("adv", ["there", "over there"]),
    "überall": ("adv", ["everywhere"]),
    "irgendwo": ("adv", ["somewhere"]),
    "nirgendwo": ("adv", ["nowhere"]),
    "jetzt": ("adv", ["now"]),
    "nun": ("adv", ["now", "well"]),
    "heute": ("adv", ["today"]),
    "gestern": ("adv", ["yesterday"]),
    "morgen_adv": ("adv", ["tomorrow"]),
    "bald": ("adv", ["soon"]),
    "gleich": ("adv", ["right away", "immediately", "same"]),
    "sofort": ("adv", ["immediately", "instantly"]),
    "zusammen": ("adv", ["together"]),
    "allein": ("adv", ["alone"]),
    "alleine": ("adv", ["alone"]),
    "gern": ("adv", ["gladly", "fondly", "with pleasure"]),
    "gerne": ("adv", ["gladly", "fondly", "with pleasure"]),
    "lieber": ("adv", ["rather", "preferably"]),
    "vielleicht": ("adv", ["maybe", "perhaps"]),
    "natürlich": ("adv", ["of course", "naturally"]),
    "wirklich": ("adv", ["really", "truly"]),
    "echt": ("adv", ["really", "genuine"]),
    "besonders": ("adv", ["especially", "particularly"]),
    "genau": ("adv", ["exactly", "precise"]),
    "sicher": ("adv", ["sure", "safe", "certainly"]),
    "so": ("adv", ["so", "thus", "like this"]),
    "nur": ("adv", ["only", "just"]),
    "sogar": ("adv", ["even"]),
    "nicht": ("part", ["not"]),
    "gar": ("adv", ["at all", "even"]),
    "kein": ("art", ["no", "not a", "none"]),
    "keine": ("art", ["no", "not a", "none"]),
    "keinen": ("art", ["no", "not a", "none"]),
    "keinem": ("art", ["no", "not a", "none"]),
    "keiner": ("art", ["no", "not a", "none"]),
    "ja": ("part", ["yes", "indeed"]),
    "nein": ("part", ["no"]),
    "doch": ("part", ["yes (contradicting no)", "after all", "indeed"]),
    "bitte": ("part", ["please", "you're welcome"]),
    "danke": ("part", ["thank you", "thanks"]),
    "hallo": ("part", ["hello", "hi"]),
    "tschüss": ("part", ["bye", "goodbye"]),
    "tschuss": ("part", ["bye", "goodbye"]),
    "auf wiedersehen": ("part", ["goodbye"]),
    "oh": ("part", ["oh"]),
    "ah": ("part", ["ah"]),
    "hurra": ("part", ["hooray"]),
    "oops": ("part", ["oops"]),
    "hoppla": ("part", ["oops", "whoops"]),
    "mal_part": ("part", ["just", "once", "for a moment"]),

    # --- Pronouns & Determiners ---
    "der": ("art", ["the"]),
    "die": ("art", ["the"]),
    "das": ("art", ["the"]),
    "ein": ("art", ["a", "an", "one"]),
    "eine": ("art", ["a", "an", "one"]),
    "einer": ("art", ["a", "an", "one"]),
    "einem": ("art", ["a", "an", "one"]),
    "einen": ("art", ["a", "an", "one"]),
    "eines": ("art", ["a", "an", "one"]),
    "mein": ("pron", ["my", "mine"]),
    "meine": ("pron", ["my"]),
    "meinen": ("pron", ["my"]),
    "meinem": ("pron", ["my"]),
    "meiner": ("pron", ["my"]),
    "dein": ("pron", ["your", "yours"]),
    "deine": ("pron", ["your"]),
    "deinen": ("pron", ["your"]),
    "deinem": ("pron", ["your"]),
    "deiner": ("pron", ["your"]),
    "sein_poss": ("pron", ["his", "its"]),
    "seine": ("pron", ["his", "its"]),
    "seinen": ("pron", ["his", "its"]),
    "seinem": ("pron", ["his", "its"]),
    "seiner": ("pron", ["his", "its"]),
    "ihr_poss": ("pron", ["her", "their", "your"]),
    "ihre": ("pron", ["her", "their", "your"]),
    "ihren": ("pron", ["her", "their", "your"]),
    "ihrem": ("pron", ["her", "their", "your"]),
    "ihrer": ("pron", ["her", "their", "your"]),
    "unser": ("pron", ["our", "ours"]),
    "unsere": ("pron", ["our"]),
    "unseren": ("pron", ["our"]),
    "unserem": ("pron", ["our"]),
    "unserer": ("pron", ["our"]),
    "euer": ("pron", ["your (plural)"]),
    "eure": ("pron", ["your (plural)"]),
    "euren": ("pron", ["your (plural)"]),
    "eurem": ("pron", ["your (plural)"]),
    "eurer": ("pron", ["your (plural)"]),
    "ich": ("pron", ["I"]),
    "mich": ("pron", ["me (accusative)"]),
    "mir": ("pron", ["me (dative)"]),
    "du": ("pron", ["you"]),
    "dich": ("pron", ["you (accusative)"]),
    "dir": ("pron", ["you (dative)"]),
    "er": ("pron", ["he"]),
    "ihn": ("pron", ["him"]),
    "ihm": ("pron", ["him (dative)"]),
    "sie": ("pron", ["she", "they", "you"]),
    "ihnen": ("pron", ["them (dative)", "you (formal)"]),
    "es": ("pron", ["it"]),
    "wir": ("pron", ["we"]),
    "uns": ("pron", ["us"]),
    "ihr": ("pron", ["you (plural)"]),
    "euch": ("pron", ["you (plural dative/accusative)"]),
    "sich": ("pron", ["oneself", "himself", "herself", "themselves"]),

    # --- Prepositions ---
    "in": ("prep", ["in", "into"]),
    "im": ("prep", ["in the"]),
    "ins": ("prep", ["into the"]),
    "an": ("prep", ["at", "on", "to"]),
    "am": ("prep", ["at the", "on the"]),
    "ans": ("prep", ["to the"]),
    "auf": ("prep", ["on", "upon", "at"]),
    "aufs": ("prep", ["onto the"]),
    "mit": ("prep", ["with"]),
    "für": ("prep", ["for"]),
    "von": ("prep", ["from", "of", "by"]),
    "vom": ("prep", ["from the"]),
    "zu": ("prep", ["to", "towards", "at", "too"]),
    "zum": ("prep", ["to the (masc/neut)"]),
    "zur": ("prep", ["to the (fem)"]),
    "über": ("prep", ["over", "above", "about"]),
    "unter": ("prep", ["under", "below", "among"]),
    "vor": ("prep", ["in front of", "before", "ago"]),
    "vorm": ("prep", ["in front of the"]),
    "hinter": ("prep", ["behind"]),
    "hinters": ("prep", ["behind the"]),
    "neben": ("prep", ["beside", "next to"]),
    "zwischen": ("prep", ["between"]),
    "nach": ("prep", ["after", "to", "towards"]),
    "bei": ("prep", ["at", "near", "with"]),
    "beim": ("prep", ["at the", "while"]),
    "aus": ("prep", ["out of", "from"]),
    "durch": ("prep", ["through", "by"]),
    "um": ("prep", ["around", "at (time)", "for"]),
    "ohne": ("prep", ["without"]),
    "gegen": ("prep", ["against", "towards"]),
    "seit": ("prep", ["since", "for (time)"]),
    "ab": ("prep", ["from", "starting at"]),
    "bis": ("prep", ["until", "till", "up to"]),

    # --- Conjunctions ---
    "und": ("conj", ["and"]),
    "oder": ("conj", ["or"]),
    "aber": ("conj", ["but", "however"]),
    "denn": ("conj", ["because", "for"]),
    "weil": ("conj", ["because"]),
    "wenn": ("conj", ["if", "when", "whenever"]),
    "als": ("conj", ["when (past)", "as", "than"]),
    "dass": ("conj", ["that"]),
    "da_conj": ("conj", ["as", "since"]),
    "ob": ("conj", ["whether", "if"]),
    "obwohl": ("conj", ["although", "even though"]),
    "damit": ("conj", ["so that", "in order that"]),
    "bevor": ("conj", ["before"]),
    "nachdem": ("conj", ["after"]),
    "während": ("conj", ["while", "during"]),

    # --- Question Words ---
    "wer": ("pron", ["who"]),
    "wen": ("pron", ["whom (accusative)"]),
    "wem": ("pron", ["whom (dative)"]),
    "wessen": ("pron", ["whose"]),
    "was": ("pron", ["what"]),
    "wo": ("adv", ["where"]),
    "wohin": ("adv", ["where to"]),
    "woher": ("adv", ["where from"]),
    "wann": ("adv", ["when"]),
    "warum": ("adv", ["why"]),
    "wieso": ("adv", ["why", "how come"]),
    "weshalb": ("adv", ["why", "for what reason"]),
    "wie": ("adv", ["how", "like", "as"]),
    "wieviel": ("pron", ["how much"]),
    "wie_viel": ("pron", ["how much"]),
    "wieviele": ("pron", ["how many"]),
    "welcher": ("pron", ["which"]),
    "welche": ("pron", ["which"]),
    "welches": ("pron", ["which"]),
    "welchen": ("pron", ["which"]),
    "welchem": ("pron", ["which"]),

    # --- Numbers ---
    "null": ("num", ["zero"]),
    "eins": ("num", ["one"]),
    "zwei": ("num", ["two"]),
    "drei": ("num", ["three"]),
    "vier": ("num", ["four"]),
    "fünf": ("num", ["five"]),
    "sechs": ("num", ["six"]),
    "sieben": ("num", ["seven"]),
    "acht": ("num", ["eight"]),
    "neun": ("num", ["nine"]),
    "zehn": ("num", ["ten"]),
    "elf": ("num", ["eleven"]),
    "zwölf": ("num", ["twelve"]),
    "dreizehn": ("num", ["thirteen"]),
    "vierzehn": ("num", ["fourteen"]),
    "fünfzehn": ("num", ["fifteen"]),
    "sechzehn": ("num", ["sixteen"]),
    "siebzehn": ("num", ["seventeen"]),
    "achtzehn": ("num", ["eighteen"]),
    "neunzehn": ("num", ["nineteen"]),
    "zwanzig": ("num", ["twenty"]),
    "dreißig": ("num", ["thirty"]),
    "vierzig": ("num", ["forty"]),
    "fünfzig": ("num", ["fifty"]),
    "hundert": ("num", ["hundred"]),
    "tausend": ("num", ["thousand"]),
    "erste": ("num", ["first"]),
    "zweite": ("num", ["second"]),
    "dritte": ("num", ["third"]),
}

# 2. Irregular Verbs explicit inflections (form -> lemma)
IRREGULAR_VERBS = {
    # sein
    "bin": "sein", "bist": "sein", "ist": "sein", "sind": "sein", "seid": "sein",
    "war": "sein", "warst": "sein", "waren": "sein", "wart": "sein", "gewesen": "sein",
    "wäre": "sein", "wären": "sein",
    # haben
    "habe": "haben", "hast": "haben", "hat": "haben", "haben": "haben", "habt": "haben",
    "hatte": "haben", "hattest": "haben", "hatten": "haben", "hattet": "haben", "gehabt": "haben",
    "hätte": "haben", "hätten": "haben",
    # werden
    "werde": "werden", "wirst": "werden", "wird": "werden", "werden": "werden", "werdet": "werden",
    "wurde": "werden", "wurdest": "werden", "wurden": "werden", "wurdet": "werden", "geworden": "werden",
    "würde": "werden", "würden": "werden",
    # können
    "kann": "können", "kannst": "können", "können": "können", "könnt": "können",
    "konnte": "können", "konntest": "können", "konnten": "können", "gekonnt": "können",
    "könnte": "können", "könnten": "können",
    # müssen
    "muss": "müssen", "musst": "müssen", "müssen": "müssen", "müsst": "müssen",
    "musste": "müssen", "musstest": "müssen", "mussten": "müssen", "gemusst": "müssen",
    "müsste": "müssen", "müssten": "müssen",
    # wollen
    "will": "wollen", "willst": "wollen", "wollen": "wollen", "wollt": "wollen",
    "wollte": "wollen", "wolltest": "wollen", "wollten": "wollen", "gewollt": "wollen",
    # sollen
    "soll": "sollen", "sollst": "sollen", "sollen": "sollen", "sollt": "sollen",
    "sollte": "sollen", "solltest": "sollen", "sollten": "sollen", "gesollt": "sollen",
    # dürfen
    "darf": "dürfen", "darfst": "dürfen", "dürfen": "dürfen", "dürft": "dürfen",
    "durfte": "dürfen", "durftest": "dürfen", "durften": "dürfen", "gedurft": "dürfen",
    "dürfte": "dürfen", "dürften": "dürfen",
    # mögen / möchten
    "mag": "mögen", "magst": "mögen", "mögt": "mögen", "mochte": "mögen", "gemocht": "mögen",
    "möchte": "möchten", "möchtest": "möchten", "möchten": "möchten", "möchtet": "möchten",
    # gehen
    "gehe": "gehen", "gehst": "gehen", "geht": "gehen", "ging": "gehen", "gingst": "gehen",
    "gingen": "gehen", "gingt": "gehen", "gegangen": "gehen",
    # kommen
    "komme": "kommen", "kommst": "kommen", "kommt": "kommen", "kam": "kommen", "kamst": "kommen",
    "kamen": "kommen", "kamt": "kommen", "gekommen": "kommen",
    # sehen
    "sehe": "sehen", "siehst": "sehen", "sieht": "sehen", "seht": "sehen", "sah": "sehen",
    "sahst": "sehen", "sahen": "sehen", "saht": "sehen", "gesehen": "sehen",
    # sprechen
    "spreche": "sprechen", "sprichst": "sprechen", "spricht": "sprechen", "sprecht": "sprechen",
    "sprach": "sprechen", "sprachst": "sprechen", "sprachen": "sprechen", "gesprochen": "sprechen",
    # essen
    "esse": "essen", "isst": "essen", "esst": "essen", "aß": "essen", "aßen": "essen", "gegessen": "essen",
    # trinken
    "trinke": "trinken", "trinkst": "trinken", "trinkt": "trinken", "trank": "trinken",
    "tranken": "trinken", "getrunken": "trinken",
    # schlafen
    "schlafe": "schlafen", "schläfst": "schlafen", "schläft": "schlafen", "schlaft": "schlafen",
    "schlief": "schlafen", "schliefen": "schlafen", "geschlafen": "schlafen",
    # wissen
    "weiß": "wissen", "weißt": "wissen", "wissen": "wissen", "wisst": "wissen",
    "wusste": "wissen", "wusstest": "wissen", "wussten": "wissen", "gewusst": "wissen",
    # nehmen
    "nehme": "nehmen", "nimmst": "nehmen", "nimmt": "nehmen", "nehmt": "nehmen",
    "nahm": "nehmen", "nahmst": "nehmen", "nahmen": "nehmen", "nahmt": "nehmen", "genommen": "nehmen",
    # geben
    "gebe": "geben", "gibst": "geben", "gibt": "geben", "gebt": "geben",
    "gab": "geben", "gabst": "geben", "gaben": "geben", "gegeben": "geben",
    # finden
    "finde": "finden", "findest": "finden", "findet": "finden", "fand": "finden",
    "fanden": "finden", "gefunden": "finden",
    # bleiben
    "bleibe": "bleiben", "bleibst": "bleiben", "bleibt": "bleiben", "blieb": "bleiben",
    "blieben": "bleiben", "geblieben": "bleiben",
    # laufen
    "laufe": "laufen", "läufst": "laufen", "läuft": "laufen", "lauft": "laufen",
    "lief": "laufen", "liefen": "laufen", "gelaufen": "laufen",
    # rennen
    "renne": "rennen", "rennst": "rennen", "rennt": "rennen", "rannte": "rennen",
    "rannten": "rennen", "gerannt": "rennen",
    # bringen
    "bringe": "bringen", "bringst": "bringen", "bringt": "bringen", "brachte": "bringen",
    "brachten": "bringen", "gebracht": "bringen",
    # denken
    "denke": "denken", "denkst": "denken", "denkt": "denken", "dachte": "denken",
    "dachten": "denken", "gedacht": "denken",
    # fahren
    "fahre": "fahren", "fährst": "fahren", "fährt": "fahren", "fahrt": "fahren",
    "fuhr": "fahren", "fuhren": "fahren", "gefahren": "fahren",
    # fallen
    "falle": "fallen", "fällst": "fallen", "fällt": "fallen", "fallt": "fallen",
    "fiel": "fallen", "fielen": "fallen", "gefallen": "fallen",
    # fliegen
    "fliege": "fliegen", "fliegst": "fliegen", "fliegt": "fliegen", "flog": "fliegen",
    "flogen": "fliegen", "geflogen": "fliegen",
    # schwimmen
    "schwimme": "schwimmen", "schwimmst": "schwimmen", "schwimmt": "schwimmen",
    "schwamm": "schwimmen", "schwammen": "schwimmen", "geschwommen": "schwimmen",
    # singen
    "singe": "singen", "singst": "singen", "singt": "singen", "sang": "singen",
    "sangen": "singen", "gesungen": "singen",
    # springen
    "springe": "springen", "springst": "springen", "springt": "springen", "sprang": "springen",
    "sprangen": "springen", "gesprungen": "springen",
    # stehen
    "stehe": "stehen", "stehst": "stehen", "steht": "stehen", "stand": "stehen",
    "standen": "stehen", "gestanden": "stehen",
    # verstehen
    "verstehe": "verstehen", "verstehst": "verstehen", "versteht": "verstehen", "verstand": "verstehen",
    "verstanden": "verstehen",
    # sitzen
    "sitze": "sitzen", "sitzt": "sitzen", "saß": "sitzen", "saßen": "sitzen", "gesessen": "sitzen",
    # liegen
    "liege": "liegen", "liegst": "liegen", "liegt": "liegen", "lag": "liegen",
    "lagen": "liegen", "gelegen": "liegen",
    # tragen
    "trage": "tragen", "trägst": "tragen", "trägt": "tragen", "tragt": "tragen",
    "trug": "tragen", "trugen": "tragen", "getragen": "tragen",
    # waschen
    "wasche": "waschen", "wäschst": "waschen", "wäscht": "waschen", "wascht": "waschen",
    "wusch": "waschen", "wuschen": "waschen", "gewaschen": "waschen",
    # werfen
    "werfe": "werfen", "wirfst": "werfen", "wirft": "werfen", "werft": "werfen",
    "warf": "werfen", "warfen": "werfen", "geworfen": "werfen",
    # fangen
    "fange": "fangen", "fängst": "fangen", "fängt": "fangen", "fangt": "fangen",
    "fing": "fangen", "fingen": "fangen", "gefangen": "fangen",
    # rufen
    "rufe": "rufen", "rufst": "rufen", "ruft": "rufen", "rief": "rufen",
    "riefen": "rufen", "gerufen": "rufen",
    # helfen
    "helfe": "helfen", "hilfst": "helfen", "hilft": "helfen", "helft": "helfen",
    "half": "helfen", "halfen": "helfen", "geholfen": "helfen",
    # lesen
    "lese": "lesen", "liest": "lesen", "lest": "lesen", "las": "lesen",
    "lasen": "lesen", "gelesen": "lesen",
    # schreiben
    "schreibe": "schreiben", "schreibst": "schreiben", "schreibt": "schreiben",
    "schrieb": "schreiben", "schrieben": "schreiben", "geschrieben": "schreiben",
    # halten
    "halte": "halten", "hältst": "halten", "hält": "halten", "haltet": "halten",
    "hielt": "halten", "hielten": "halten", "gehalten": "halten",
    # verlieren
    "verliere": "verlieren", "verlierst": "verlieren", "verliert": "verlieren",
    "verlor": "verlieren", "verloren": "verlieren",
    # vergessen
    "vergesse": "vergessen", "vergisst": "vergessen", "vergesst": "vergessen",
    "vergaß": "vergessen", "vergessen": "vergessen",
    # tun
    "tue": "tun", "tust": "tun", "tut": "tun", "tat": "tun", "taten": "tun", "getan": "tun",
}

# 3. Common noun plurals and declensions
NOUN_INFLECTIONS = {
    # pfütze / stiefel / matsch
    "pfützen": "pfütze", "stiefeln": "stiefel", "stiefel": "stiefel",
    "schweine": "schwein", "schweinen": "schwein", "schweinchen": "schwein",
    "hunde": "hund", "hunden": "hund",
    "katzen": "katze",
    "tiere": "tier", "tieren": "tier",
    "pferde": "pferd", "pferden": "pferd",
    "kinder": "kind", "kindern": "kind",
    "mädchen": "mädchen", "mädels": "mädchen",
    "jungen": "junge", "jungs": "junge",
    "eltern": "eltern",
    "freunde": "freund", "freunden": "freund",
    "freundinnen": "freundin",
    "häuser": "haus", "häusern": "haus",
    "bäume": "baum", "bäumen": "baum",
    "blumen": "blume",
    "berge": "berg", "bergen": "berg",
    "autos": "auto", "züge": "zug", "zügen": "zug", "bälle": "ball", "bällen": "ball",
    "spiele": "spiel", "spielen": "spiel", "bücher": "buch", "büchern": "buch",
    "geschichten": "geschichte", "lieder": "lied", "liedern": "lied",
    "tage": "tag", "tagen": "tag", "nächte": "nacht", "nächten": "nacht",
    "jahre": "jahr", "jahren": "jahr", "monate": "monat", "monaten": "monat",
    "wochen": "woche", "stunden": "stunde", "minuten": "minute", "sekunden": "sekunde",
    "augen": "auge", "ohren": "ohr", "hände": "hand", "händen": "hand",
    "füße": "fuß", "füßen": "fuß", "finger": "finger", "fingern": "finger",
    "beine": "bein", "beinen": "bein", "arme": "arm", "armen": "arm",
    "zähne": "zahn", "zähnen": "zahn",
    "brüder": "bruder", "brüdern": "bruder", "schwestern": "schwester",
    "mütter": "mutter", "müttern": "mutter", "väter": "vater", "vätern": "vater",
    "söhne": "sohn", "söhnen": "sohn", "töchter": "tochter", "töchtern": "tochter",
    "onkel": "onkel", "tanten": "tante",
    "steine": "stein", "steinen": "stein",
    "schuhe": "schuh", "schuhen": "schuh",
    "hosen": "hose", "jacken": "jacke", "mützen": "mütze", "hüte": "hut", "hüten": "hut",
    "brillen": "brille", "taschen": "tasche",
    "teller": "teller", "tassen": "tasse", "gläser": "glas", "gläsern": "glas",
    "flaschen": "flasche", "äpfel": "apfel", "äpfeln": "apfel", "bananen": "banane",
    "kekse": "keks", "keksen": "keks", "kuchen": "kuchen",
    "vögel": "vogel", "vögeln": "vogel", "enten": "ente", "frösche": "frosch", "fröschen": "frosch",
    "hasen": "hase", "kaninchen": "kaninchen", "kühe": "kuh", "kühen": "kuh",
    "schafe": "schaf", "schafen": "schaf", "ziegen": "ziege", "hühner": "huhn", "hühnern": "huhn",
    "fische": "fisch", "fischen": "fisch", "mäuse": "maus", "mäusen": "maus",
    "bären": "bär", "löwen": "löwe", "elefanten": "elefant",
    "schulen": "schule", "städte": "stadt", "städten": "stadt", "dörfer": "dorf", "dörfern": "dorf",
    "straßen": "straße", "wege": "weg", "wegen": "weg",
    "probleme": "problem", "problemen": "problem", "fragen": "frage", "antworten": "antwort",
    "ideen": "idee", "geschenke": "geschenk", "geschenken": "geschenk",
}

# 4. Articles & Pronoun case forms
ARTICLES_AND_PRONOUNS = {
    # der / die / das / den / dem / des
    "der": "der", "die": "der", "das": "der", "den": "der", "dem": "der", "des": "der",
    # ein / eine / einen / einem / einer / eines
    "ein": "ein", "eine": "ein", "einen": "ein", "einem": "ein", "einer": "ein", "eines": "ein",
    # kein
    "kein": "kein", "keine": "kein", "keinen": "kein", "keinem": "kein", "keiner": "kein", "keines": "kein",
    # mein / dein / sein / ihr / unser / euer
    "mein": "mein", "meine": "mein", "meinen": "mein", "meinem": "mein", "meiner": "mein", "meines": "mein",
    "dein": "dein", "deine": "dein", "deinen": "dein", "deinem": "dein", "deiner": "dein", "deines": "dein",
    "sein": "sein", "seine": "sein", "seinen": "sein", "seinem": "sein", "seiner": "sein", "seines": "sein",
    "ihr": "ihr", "ihre": "ihr", "ihren": "ihr", "ihrem": "ihr", "ihrer": "ihr", "ihres": "ihr",
    "unser": "unser", "unsere": "unser", "unseren": "unser", "unserem": "unser", "unserer": "unser", "unseres": "unser",
    "euer": "euer", "eure": "euer", "euren": "euer", "eurem": "euer", "eurer": "euer", "eures": "euer",
    # personal pronouns
    "ich": "ich", "mich": "ich", "mir": "ich",
    "du": "du", "dich": "du", "dir": "du",
    "er": "er", "ihn": "er", "ihm": "er",
    "sie": "sie", "ihnen": "sie",
    "es": "es",
    "wir": "wir", "uns": "wir",
    "euch": "ihr",
}

def auto_generate_verb_forms(lemma):
    """Generates standard regular German verb forms for a given infinitive ending in -en or -n."""
    forms = {}
    if lemma.endswith("en"):
        stem = lemma[:-2]
    elif lemma.endswith("n"):
        stem = lemma[:-1]
    else:
        return forms

    # Present tense
    forms[stem + "e"] = lemma
    forms[stem + "st"] = lemma
    forms[stem + "t"] = lemma
    forms[stem + "en"] = lemma
    forms[lemma] = lemma

    # If stem ends in d or t (e.g. wart-en, antwort-en)
    if stem.endswith("t") or stem.endswith("d"):
        forms[stem + "est"] = lemma
        forms[stem + "et"] = lemma
        forms[stem + "ete"] = lemma
        forms[stem + "etest"] = lemma
        forms[stem + "eten"] = lemma
        forms[stem + "etet"] = lemma
        forms["ge" + stem + "et"] = lemma
    else:
        # Regular simple past
        forms[stem + "te"] = lemma
        forms[stem + "test"] = lemma
        forms[stem + "ten"] = lemma
        forms[stem + "tet"] = lemma
        # Regular past participle
        forms["ge" + stem + "t"] = lemma

    return forms

def auto_generate_adj_forms(lemma):
    """Generates adjective declension endings (-e, -en, -er, -es, -em)."""
    forms = {lemma: lemma}
    for ending in ["e", "en", "er", "es", "em"]:
        forms[lemma + ending] = lemma
    return forms

def auto_generate_noun_forms(lemma):
    """Generates standard noun inflections (e.g. -n, -en, -s)."""
    forms = {lemma: lemma}
    if lemma.endswith("e"):
        forms[lemma + "n"] = lemma
    elif not lemma.endswith("en"):
        forms[lemma + "s"] = lemma
        forms[lemma + "en"] = lemma
        forms[lemma + "e"] = lemma
    return forms

def main():
    form_to_lemma = {}
    dictionary = {}

    # 1. Build dictionary lemmas
    for lemma, (pos, glosses) in LEXICON.items():
        dictionary[lemma.lower()] = {
            "pos": pos,
            "glosses": glosses
        }
        form_to_lemma[lemma.lower()] = lemma.lower()

    # 2. Add Irregular verbs and explicit inflections
    for form, lemma in IRREGULAR_VERBS.items():
        form_to_lemma[form.lower()] = lemma.lower()

    # 3. Add explicit noun inflections
    for form, lemma in NOUN_INFLECTIONS.items():
        form_to_lemma[form.lower()] = lemma.lower()

    # 4. Add articles and pronouns
    for form, lemma in ARTICLES_AND_PRONOUNS.items():
        form_to_lemma[form.lower()] = lemma.lower()

    # 5. Algorithmic expansion for all verbs, adjectives, and nouns in lexicon
    for lemma, (pos, _) in LEXICON.items():
        lemma_lower = lemma.lower()
        if pos == "verb":
            vforms = auto_generate_verb_forms(lemma_lower)
            for f, l in vforms.items():
                if f not in form_to_lemma:
                    form_to_lemma[f] = l
        elif pos == "adj":
            aforms = auto_generate_adj_forms(lemma_lower)
            for f, l in aforms.items():
                if f not in form_to_lemma:
                    form_to_lemma[f] = l
        elif pos == "noun":
            nforms = auto_generate_noun_forms(lemma_lower)
            for f, l in nforms.items():
                if f not in form_to_lemma:
                    form_to_lemma[f] = l

    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    os.makedirs(out_dir, exist_ok=True)

    form_file = os.path.join(out_dir, "form-to-lemma.json")
    dict_file = os.path.join(out_dir, "lemma-to-gloss.json")

    with open(form_file, "w", encoding="utf-8") as f:
        json.dump(form_to_lemma, f, ensure_ascii=False, indent=2)

    with open(dict_file, "w", encoding="utf-8") as f:
        json.dump(dictionary, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated {len(form_to_lemma)} inflected form mappings in {form_file}")
    print(f"Successfully generated {len(dictionary)} dictionary entries in {dict_file}")

if __name__ == "__main__":
    main()
