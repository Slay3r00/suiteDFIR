import { Link } from 'react-router-dom';

interface ToolNotInstalledProps {
  tool: 'ileapp' | 'aleapp';
}

const toolInfo = {
  ileapp: {
    name: 'iLEAPP',
    description: 'iOS Logs, Events, And Plist Parser',
  },
  aleapp: {
    name: 'aLEAPP',
    description: 'Android Logs, Events, And Protobuf Parser',
  },
};

export default function ToolNotInstalled({ tool }: ToolNotInstalledProps) {
  const info = toolInfo[tool];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#151515] text-center px-4">


      <h2 className="text-xl font-semibold text-white mb-2">Tool Not Installed</h2>
      <p className="text-sm text-white/50 mb-6 max-w-md">
        You must download <span className="text-white font-medium">{info.name}</span> in Preferences before using this feature.
      </p>
      <Link
        to="/preferences"
        className="px-6 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors"
      >
        Go to Preferences
      </Link>
    </div>
  );
}

