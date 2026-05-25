#!/usr/bin/env node
import { dockerComposeArgs, ensureDockerAvailable, run } from "./common.mjs";

ensureDockerAvailable();
run("docker", dockerComposeArgs(["up", "-d", "--remove-orphans"]));
console.log("[local-start] stack started; run npm run local:health for readiness");
