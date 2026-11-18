# Native418 CI transport recovery

The complete eb5e88297 Architecture database gate ran 275 suites and 2,243
assertions. One assertion failed: the loyalty reversal suite's private-role
negative controls followed by worker discovery. Its other 17 assertions passed.
The isolated unchanged-source rerun passed all 18 assertions, without a discovery
RPC refusal or transport error in the diagnostic observer. The original failed
run remains failed. Unit and merge-safety jobs were interrupted separately; their
incomplete steps are not successful checks.

The owned REST proxy used Node's shared upstream HTTP agent. A real HTTP
regression control demonstrates that successive mutation requests reuse the same
upstream connection. The fixture now uses a fresh upstream connection per request
instead of risking reuse of a closed idle socket. It never retries a mutation.
Two real HTTP controls prove distinct upstream connections with unchanged bodies
and authorization, and exactly one effect when the first reply is lost. The
fresh-connection control fails against the previous proxy and both controls pass
after the change.

Socket reuse is a transport hazard demonstrated by the control, not conclusive
attribution of the historical loyalty failure. The reported two upstream errors
also occur in the successful unchanged-source rerun and can include readiness
probes; their count alone does not establish the failure's cause. Preserve this
distinction and require the complete corrected-source CI gates to pass.

This changes local fixture transport only. Loyalty rules, queue recovery,
permissions, ledgers, hosted routes, native418 SQL and its rollback are unchanged.
The native418-only recovery admission, staging acceptance, branch alignment,
production activation and physical-iPhone acceptance gates remain mandatory.
