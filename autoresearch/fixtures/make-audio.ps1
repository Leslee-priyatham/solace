# Builds fixtures/dialogue.wav (two synthetic voices: Zira = therapist, David = client), fixtures/dialogue.json
# (ground-truth script) and fixtures/silence.wav. All content is fictional.
Add-Type -AssemblyName System.Speech
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$lines = @(
  @("PROVIDER", "Microsoft Zira Desktop", "Welcome back. Last week you said your sleep was getting worse. How has it been?"),
  @("CLIENT",   "Microsoft David Desktop", "A little better. I stopped drinking coffee after two in the afternoon, and I fell asleep before midnight four nights this week."),
  @("PROVIDER", "Microsoft Zira Desktop", "That is a real change. What happened on the other three nights?"),
  @("CLIENT",   "Microsoft David Desktop", "I was worrying about the budget meeting on Thursday. I kept replaying what my boss might say."),
  @("PROVIDER", "Microsoft Zira Desktop", "Let's try scheduling a worry period. Fifteen minutes at seven in the evening, written down in a notebook."),
  @("CLIENT",   "Microsoft David Desktop", "Okay. I can do that after dinner."),
  @("PROVIDER", "Microsoft Zira Desktop", "Good. We will review the notebook together next Tuesday.")
)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$pb = New-Object System.Speech.Synthesis.PromptBuilder
foreach ($l in $lines) {
  $pb.StartVoice($l[1]); $pb.AppendText($l[2]); $pb.EndVoice()
  $pb.AppendBreak([TimeSpan]::FromMilliseconds(700))
}
$s.SetOutputToWaveFile((Join-Path $here "dialogue.wav"), $fmt)
$s.Speak($pb)
$s.SetOutputToNull()
# 3 seconds of silence
$pb2 = New-Object System.Speech.Synthesis.PromptBuilder
$pb2.AppendBreak([TimeSpan]::FromSeconds(3))
$s.SetOutputToWaveFile((Join-Path $here "silence.wav"), $fmt)
$s.Speak($pb2)
$s.Dispose()
$truth = $lines | ForEach-Object { @{ speaker = $_[0]; text = $_[2] } }
$truth | ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $here "dialogue.json")
Get-ChildItem $here -Filter *.wav | ForEach-Object { "$($_.Name) $($_.Length) bytes" }
