import { useState, useEffect } from 'react';

export default function IosInstallPrompt({ forceOpen = false, onCloseModal = null }) {
  const [showModal, setShowModal] = useState(false);
  const [isChromeOnIos, setIsChromeOnIos] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsChromeOnIos(/crios/.test(userAgent));
    }
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setShowModal(true);
    }
  }, [forceOpen]);

  const handleCloseModal = () => {
    setShowModal(false);
    if (onCloseModal) onCloseModal();
  };

  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in text-white">
      <div className="w-full max-w-sm bg-[#141414] rounded-3xl border border-white/10 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <img src="/app-icon.jpg" alt="Our Space" className="w-8 h-8 rounded-xl border border-white/10" />
            <div>
              <h3 className="font-bold text-sm text-white">Install on iOS</h3>
              <p className="text-[11px] text-gray-400">Add to Home Screen (Safari / Chrome)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>

        {/* Instruction Steps */}
        <div className="space-y-3.5 text-xs text-gray-200">
          
          {/* Step 1 */}
          <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-2xl border border-white/5">
            <div className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="font-semibold text-white">
                {isChromeOnIos ? 'Tap the Share icon at top-right' : 'Tap the Share button at the bottom of Safari'}
              </p>
              <p className="text-gray-400 text-[11px] mt-0.5">
                Look for the square icon with an upward arrow:
              </p>
              <div className="inline-flex items-center gap-1.5 px-2 py-1 mt-1.5 bg-white/10 rounded-lg text-white font-medium text-[11px]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Share / Bagikan</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-2xl border border-white/5">
            <div className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="font-semibold text-white">Scroll down & tap "Add to Home Screen"</p>
              <p className="text-gray-400 text-[11px] mt-0.5">
                Or <span className="text-gray-300 italic">"Tambahkan ke Layar Utama"</span>.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2 py-1 mt-1.5 bg-white/10 rounded-lg text-white font-medium text-[11px]">
                <span className="text-sm font-bold">＋</span>
                <span>Add to Home Screen</span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-2xl border border-white/5">
            <div className="w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="font-semibold text-white">Tap "Add" in the top-right corner</p>
              <p className="text-gray-400 text-[11px] mt-0.5">
                Our Space will open in fullscreen app mode with push notifications!
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleCloseModal}
            className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-gray-200 transition-colors"
          >
            Got It!
          </button>
        </div>

      </div>
    </div>
  );
}
