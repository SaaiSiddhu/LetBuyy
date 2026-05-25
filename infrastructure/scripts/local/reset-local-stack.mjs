#!/usr/bin/env node
import { dockerComposeArgs, ensureDockerAvailable, run } from "./common.mjs";

ensureDockerAvailable();
run("docker", dockerComposeArgs(["down", "--volumes", "--remove-orphans"]));
run("docker", dockerComposeArgs(["up", "-d", "--remove-orphans"]));
console.log("[local-reset] stack reset complete; run pnpm run local:seed && pnpm run local:health");
