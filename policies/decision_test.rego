package agent.call_test

import rego.v1

import data.agent.call

# ---------- getWeather ----------

test_weather_allowed_city if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "getWeather"},
		"args": {"city": "San Francisco"},
	}
}

test_weather_allowed_case_insensitive if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "getWeather"},
		"args": {"city": "  berlin  "},
	}
}

test_weather_denied_city if {
	d := call.decision with input as {
		"tool": {"name": "getWeather"},
		"args": {"city": "Atlantis"},
	}
	d.decision == "deny"
	contains(d.reason, "Atlantis")
	contains(d.reason, "San Francisco")
}

test_weather_denied_non_string_city if {
	d := call.decision with input as {
		"tool": {"name": "getWeather"},
		"args": {"city": null},
	}
	d.decision == "deny"
	contains(d.reason, "this location")
}

# ---------- searchWeb ----------

test_websearch_allowed_specific_domain if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "searchWeb"},
		"args": {"query": "AI SDK", "specificDomain": "vercel.com"},
	}
}

test_websearch_allowed_case_insensitive if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "searchWeb"},
		"args": {"query": "AI SDK", "specificDomain": "VERCEL.COM"},
	}
}

test_websearch_denied_null_domain if {
	d := call.decision with input as {
		"tool": {"name": "searchWeb"},
		"args": {"query": "premier league news", "specificDomain": null},
	}
	d.decision == "deny"
	contains(d.reason, "vercel.com")
}

test_websearch_denied_wrong_domain if {
	call.decision.decision == "deny" with input as {
		"tool": {"name": "searchWeb"},
		"args": {"query": "news", "specificDomain": "bbc.com"},
	}
}

# ---------- throwDice ----------

test_dice_allowed_channel if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "throwDice"},
		"args": {},
		"runtimeContext": {"channelId": "C0B6YBUHMME"},
	}
}

test_dice_denied_channel if {
	d := call.decision with input as {
		"tool": {"name": "throwDice"},
		"args": {},
		"runtimeContext": {"channelId": "C0OTHER"},
	}
	d.decision == "deny"
	contains(d.reason, "designated channel")
}

# ---------- bash ----------

test_bash_allowed_echo if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "bash"},
		"args": {"command": "echo hello"},
		"bash": {"program": "echo", "argv": ["echo", "hello"], "suspicious": false},
	}
}

test_bash_allowed_ls if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "bash"},
		"args": {"command": "ls -la"},
		"bash": {"program": "ls", "argv": ["ls", "-la"], "suspicious": false},
	}
}

test_bash_denied_rm if {
	d := call.decision with input as {
		"tool": {"name": "bash"},
		"args": {"command": "rm -rf ."},
		"bash": {"program": "rm", "argv": ["rm", "-rf", "."], "suspicious": false},
	}
	d.decision == "deny"
	contains(d.reason, "rm")
}

test_bash_denied_curl if {
	call.decision.decision == "deny" with input as {
		"tool": {"name": "bash"},
		"args": {"command": "curl example.com"},
		"bash": {"program": "curl", "argv": ["curl", "example.com"], "suspicious": false},
	}
}

test_bash_denied_git if {
	d := call.decision with input as {
		"tool": {"name": "bash"},
		"args": {"command": "git status"},
		"bash": {"program": "git", "argv": ["git", "status"], "suspicious": false},
	}
	d.decision == "deny"
	contains(d.reason, "git")
}

test_bash_denied_chained if {
	d := call.decision with input as {
		"tool": {"name": "bash"},
		"args": {"command": "echo hi && rm -rf /"},
		"bash": {"program": "echo", "argv": ["echo", "hi"], "suspicious": true},
	}
	d.decision == "deny"
	contains(d.reason, "single")
}

test_bash_denied_env_launcher if {
	d := call.decision with input as {
		"tool": {"name": "bash"},
		"args": {"command": "env FOO=bar rm -rf ."},
		"bash": {"program": "env", "argv": ["env", "FOO=bar", "rm", "-rf", "."], "suspicious": false},
	}
	d.decision == "deny"
	contains(d.reason, "env")
}

test_bash_denied_find_launcher if {
	d := call.decision with input as {
		"tool": {"name": "bash"},
		"args": {"command": "find . -exec cat {} +"},
		"bash": {"program": "find", "argv": ["find", ".", "-exec", "cat", "{}", "+"], "suspicious": false},
	}
	d.decision == "deny"
	contains(d.reason, "find")
}

test_bash_denied_absolute_path_arg if {
	d := call.decision with input as {
		"tool": {"name": "bash"},
		"args": {"command": "cat /etc/passwd"},
		"bash": {"program": "cat", "argv": ["cat", "/etc/passwd"], "suspicious": false},
	}
	d.decision == "deny"
	contains(d.reason, "relative paths")
}

test_bash_denied_traversal_path_arg if {
	d := call.decision with input as {
		"tool": {"name": "bash"},
		"args": {"command": "cat ../secret"},
		"bash": {"program": "cat", "argv": ["cat", "../secret"], "suspicious": false},
	}
	d.decision == "deny"
	contains(d.reason, "relative paths")
}

test_bash_allowed_relative_path_arg if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "bash"},
		"args": {"command": "cat notes.txt"},
		"bash": {"program": "cat", "argv": ["cat", "notes.txt"], "suspicious": false},
	}
}

# ---------- file access ----------

test_read_file_allowed_relative if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "readFile"},
		"args": {"path": "notes.txt"},
	}
}

test_read_file_denied_absolute if {
	d := call.decision with input as {
		"tool": {"name": "readFile"},
		"args": {"path": "/etc/passwd"},
	}
	d.decision == "deny"
}

test_read_file_denied_traversal if {
	d := call.decision with input as {
		"tool": {"name": "readFile"},
		"args": {"path": "../secret"},
	}
	d.decision == "deny"
}

test_write_file_denied if {
	d := call.decision with input as {
		"tool": {"name": "writeFile"},
		"args": {"path": "notes.txt", "content": "x"},
	}
	d.decision == "deny"
	contains(d.reason, "read-only")
}

# ---------- default-deny ----------

test_unknown_tool_denied if {
	d := call.decision with input as {
		"tool": {"name": "somethingElse"},
		"args": {},
	}
	d.decision == "deny"
	contains(d.reason, "not permitted")
}
