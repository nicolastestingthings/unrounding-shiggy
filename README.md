# Unrounding-shiggy

A conservative adaptation of system24's mobile unrounding plugin for ShiggyCord/Kettu-family loaders.

This version intentionally keeps:
- Metro registry style sweep
- StyleSheet.create patch
- border/corner radius zeroing

It intentionally removes the original plugin's more invasive hooks:
- JSX runtime patching
- React.createElement patching
- ReactNativeAttributePayload create/diff patching
- MaskedView replacement

Those hooks are more likely to conflict with newer Discord React Native internals.

## Install

https://nicolastestingthings.github.io/unrounding-shiggy/

## Important

This is an experimental compatibility build. It will not square shapes that are created without border-radius styles (for example some masks/circles).
