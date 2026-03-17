import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface AboutProps {
  onBack: () => void;
}

export const About: React.FC<AboutProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
      <button 
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-[#00796b] font-medium hover:text-teal-800"
      >
        <ArrowLeft size={20} />
        Back to Chat
      </button>

      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-[#00796b]">About GovAssist+</h1>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">English</h2>
          <p className="text-gray-600">
            GovAssist+ is an AI-powered assistant designed to simplify access to government services. 
            Our mission is to make bureaucratic processes transparent, accessible, and easy to navigate for everyone.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">తెలుగు (Telugu)</h2>
          <p className="text-gray-600">
            GovAssist+ అనేది ప్రభుత్వ సేవలను సులభతరం చేయడానికి రూపొందించబడిన AI-ఆధారిత సహాయకుడు. 
            ప్రభుత్వ ప్రక్రియలను పారదర్శకంగా, అందరికీ అందుబాటులో ఉండేలా మరియు సులభంగా అర్థం చేసుకునేలా చేయడం మా లక్ష్యం.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">हिंदी (Hindi)</h2>
          <p className="text-gray-600">
            GovAssist+ एक AI-संचालित सहायक है जिसे सरकारी सेवाओं तक पहुंच को सरल बनाने के लिए डिज़ाइन किया गया है। 
            हमारा मिशन सरकारी प्रक्रियाओं को पारदर्शी, सुलभ और सभी के लिए नेविगेट करने में आसान बनाना है।
          </p>
        </section>
      </div>
    </div>
  );
};
