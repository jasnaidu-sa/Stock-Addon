$mcpConfig = @{
    mcpServers = @{
        SupabaseQ = @{
            command = "cmd"
            args = @(
                "/c",
                "npx",
                "-y",
                "@modelcontextprotocol/server-postgres",
                "postgresql://postgres.cfjvskafvcljvxnawccs:@Priyen@1234@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
            )
        }
        Magic = @{
            command = "cmd"
            args = @(
                "/c",
                "npx",
                "-y",
                "@smithery/cli@latest",
                "run",
                "@21st-dev/magic-mcp",
                "--config",
                "`"{`\`"TWENTY_FIRST_API_KEY`\`":`\`"fb56429599794dff42ffc93cfd266b668b622139bd085f4706a6abb04a417497`\`"}`""
            )
        }
        "server-sequential-thinking" = @{
            command = "cmd"
            args = @(
                "/c",
                "npx",
                "-y",
                "@smithery/cli@latest",
                "install",
                "@smithery-ai/server-sequential-thinking",
                "--client",
                "cursor",
                "--key",
                "7e8cc572-f773-4990-a58e-513785b00af4"
            )
        }
        "browser-tools" = @{
            command = "cmd"
            args = @(
                "/c",
                "npx",
                "-y",
                "@agentdeskai/browser-tools-mcp@1.2.0"
            )
        }
    }
}

$mcpConfig | ConvertTo-Json -Depth 10 | Set-Content -Path "C:/Users/JNaidu/.cursor/mcp.json" 