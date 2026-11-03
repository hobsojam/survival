# Wood storage expansion

The woven pack carries at most sixteen items, so the first woodpile now holds twenty-four wood. The existing house woodshed still adds twenty-four to the same store.

After building the woodpile, the player can build a one-time **Timber yard** for eight wood and two fiber. It adds another twenty-four wood capacity and gives the woodpile a larger rack and roof. The yard is listed with other Build options and disappears after construction. It has no separate store or map site.

Capacity is twenty-four for a woodpile, forty-eight for a woodpile and yard, forty-eight for a woodpile and house, and seventy-two for all three. A house without a woodpile still holds twenty-four. Existing wood spending and automatic storage use the shared capacity.

The saved shape gains `structures.timberYard`. Version 30 saves migrate to version 31 with the yard unbuilt; their stored wood remains unchanged. Validation requires a woodpile before a yard and rejects wood above the resulting capacity.
