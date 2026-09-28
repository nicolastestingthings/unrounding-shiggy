(() => {
    /*
     * Unrounding-Shiggy
     * Shiggy/Kettu-safe variant of system24 unrounding.
     *
     * Deliberately does NOT patch:
     *   - JSX jsx/jsxs/jsxDEV
     *   - React.createElement
     *   - ReactNativeAttributePayload create/diff
     *   - MaskedView
     *
     * Those hooks are the aggressive parts of the original plugin and can
     * interfere with newer Discord/Shiggy React Native components.
     *
     * This version handles existing Metro styles and every StyleSheet.create()
     * call made after the plugin loads.
     */
    const { metro, patcher, logger } = vendetta;
    const { StyleSheet } = metro.common.ReactNative;

    const RADIUS_KEYS = [
        "borderRadius",
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius",
        "borderTopStartRadius",
        "borderTopEndRadius",
        "borderBottomStartRadius",
        "borderBottomEndRadius",
        "borderStartStartRadius",
        "borderStartEndRadius",
        "borderEndStartRadius",
        "borderEndEndRadius",
    ];

    const TOKEN_KEYS = new Set([
        "radii",
        "radius",
        "borderRadii",
        "radiusTokens",
        "RadiusTokens",
        "cornerRadius",
        "CornerRadius",
    ]);

    const CIRCLE_THRESHOLD = 100;
    const MAX_DEPTH = 6;
    const MAX_VISITS = 400000;

    let unpatches = [];
    let undoLog = [];
    let visits = 0;

    function isZeroable(value) {
        if (typeof value === "number") {
            if (value === 0) return false;
            return value < CIRCLE_THRESHOLD;
        }
        if (typeof value === "string" && value.endsWith("%")) return true;
        return false;
    }

    function zeroFor(value) {
        return typeof value === "string" ? "0%" : 0;
    }

    function setZero(object, key, value) {
        try {
            object[key] = zeroFor(value);
            undoLog.push([object, key, value]);
        } catch (_) {}
    }

    function zeroTokenObject(tokens) {
        if (!tokens || typeof tokens !== "object") return;
        for (const key of Object.keys(tokens)) {
            let value;
            try { value = tokens[key]; } catch (_) { continue; }
            if (isZeroable(value)) setZero(tokens, key, value);
        }
    }

    function sweep(node, depth, seen) {
        if (!node || typeof node !== "object") return;
        if (depth > MAX_DEPTH || visits > MAX_VISITS) return;
        if (seen.has(node)) return;
        seen.add(node);
        visits++;

        if (Array.isArray(node)) {
            for (const item of node) sweep(item, depth + 1, seen);
            return;
        }

        let keys;
        try { keys = Object.keys(node); } catch (_) { return; }

        for (const key of keys) {
            let value;
            try { value = node[key]; } catch (_) { continue; }

            if (RADIUS_KEYS.includes(key)) {
                if (isZeroable(value)) setZero(node, key, value);
            } else if (TOKEN_KEYS.has(key)) {
                zeroTokenObject(value);
            } else if (value && typeof value === "object") {
                sweep(value, depth + 1, seen);
            }
        }
    }

    function sweepRegistry() {
        const modules = metro.modules;
        const seen = new WeakSet();
        visits = 0;

        for (const id in modules) {
            const module = modules[id];
            if (!module || !module.isInitialized || module.hasError) continue;

            let exports;
            try {
                exports = module.publicModule && module.publicModule.exports;
            } catch (_) {
                continue;
            }

            if (!exports || exports === globalThis) continue;
            sweep(exports, 0, seen);
        }
    }

    function apply() {
        sweepRegistry();

        unpatches.push(
            patcher.after("create", StyleSheet, (_args, styles) => {
                try {
                    visits = 0;
                    sweep(styles, 0, new WeakSet());
                } catch (error) {
                    try { logger.error("Unrounding-Shiggy StyleSheet error", error); } catch (_) {}
                }
                return styles;
            })
        );

        try {
            logger.log("Unrounding-Shiggy loaded");
        } catch (_) {}
    }

    function revert() {
        for (const unpatch of unpatches) {
            try { unpatch(); } catch (_) {}
        }
        unpatches = [];

        for (let i = undoLog.length - 1; i >= 0; i--) {
            const [object, key, value] = undoLog[i];
            try { object[key] = value; } catch (_) {}
        }
        undoLog = [];
    }

    return {
        onLoad() {
            apply();
        },
        onUnload() {
            revert();
        },
    };
})()
