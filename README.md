# OpenClaw NVIDIA Integration

OpenClaw fork with NVIDIA service provider integration, built for improved performance and scalability.

## Quick Start
Add your NVIDIA API key in the .env file.
<br>
Run:
```bash
git clone https://github.com/harshkushwaha0101/openclaw-nvidia-integrated.git
cd openclaw-nvidia-integrated
pnpm install
pnpm build
pnpm openclaw setup
pnpm openclaw configure
```
See 'Install & Build dependencies' section for configuration steps.
<br>

Then run:
```bash
pnpm openclaw gateway
```
Your OpenClaw instance should now be up and running with NVIDIA provider support.

<img width="1896" height="858" alt="image" src="https://github.com/user-attachments/assets/f8d40cd9-4526-48b4-b1d9-02786696d463" />


## Detailed Installation

```bash
git clone https://github.com/harshkushwaha0101/openclaw-nvidia-integrated.git
cd openclaw-nvidia-integrated
```

### Configuration
Add your NVIDIA api key in .env file. Update environment variables if needed.

### Install & Build dependencies
**Note:** Stay connected to Internet while running these commands.
```bash
pnpm install
pnpm build
pnpm openclaw setup
pnpm openclaw configure
```
Run these commands one-by-one in project terminal and then OpenClaw Configure panel will open. Follow these steps:
1. Choose 'Local Machine' under 'Where will the Gateway run?'.
2. Select 'Model' and Continue under 'Select sections to configure'.
3. Select 'Skip for Now' option under 'Model/auth provider'
4. Select 'Nvidia' under 'Filter models by provider'.
5. Select 'nvidia/moonshotai/kimi-k2.5' under 'Default model'.
6. Select following models using Space and then press Enter to Continue:
   - nvidia/z-ai/glm4.7
   - nvidia/qwen/qwen3-coder-480b-a35b-instruct
   - nvidia/minimaxai/minimax-m2.5
   - nvidia/meta/llama-3.3-70b-instruct
   - nvidia/meta/llama-3.1-8b-instruct
   - nvidia/meta/llama-3.1-70b-instruct
   - nvidia/meta/llama-3.1-405b-instruct
8. Select 'Continue' under 'Select sections to configure' this time.

### Usage
After adding API to .env file and performing the above steps,
<br>
Simply Run:
```bash
pnpm openclaw gateway
```

## Features
- NVIDIA service provider integrated
- Improved execution efficiency
- Modular and extensible architecture
- Easy to extend with additional providers
- Clean and developer-friendly structure

## Architecture
This fork extends OpenClaw by introducing a service provider layer, making it easier to plug in external services while keeping the core system clean and maintainable.

## Roadmap
- Add support for multiple providers
- Improve configuration system
- Add benchmarking tools
- Documentation improvements
- Contributing

## Why this fork?
This fork simplifies the integration of NVIDIA as a service provider in OpenClaw.
<br>
Instead of manually configuring providers or modifying internal logic, this version provides a more streamlined and ready-to-use setup. It is designed for developers who want a smoother setup experience and a cleaner way to extend OpenClaw with additional providers in the future.

Key benefits:

Faster setup with minimal manual configuration
Cleaner provider integration approach
Easier to extend and maintain

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss proposed changes.

## License
Same as the original OpenClaw project.
