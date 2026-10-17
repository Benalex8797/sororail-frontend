---
"@sororail/sdk": patch
---

`asVoid` now checks that an entry point declared to return `()` actually returned nothing (`undefined` or `null`) and throws a `ValidationError` otherwise, so a contract that does not match this SDK version fails loudly instead of having its return value silently discarded.
