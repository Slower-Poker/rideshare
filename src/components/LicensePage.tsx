import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { SharedProps, ViewType } from '../types';

const VIEW_STORAGE_KEY = 'rideshare_current_view';

export function LicensePage({ setCurrentView }: SharedProps) {
  const [previousView, setPreviousView] = useState<ViewType>('home');

  // Determine the previous view to return to when back button is clicked
  useEffect(() => {
    // Check for stored previous view (set when navigating to license)
    const prevView = sessionStorage.getItem('rideshare_previous_view');
    if (prevView && prevView !== 'license') {
      // Valid previous view stored
      setPreviousView(prevView as ViewType);
    } else {
      // Fallback to stored current view (if any)
      const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
      if (stored && stored !== 'license') {
        setPreviousView(stored as ViewType);
      } else {
        // Default to home if no previous view stored
        setPreviousView('home');
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setCurrentView(previousView)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={`Back to ${previousView}`}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">License</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              GNU GENERAL PUBLIC LICENSE
            </h2>
            <p className="text-gray-600 mb-1">Version 3, 29 June 2007</p>
            <p className="text-sm text-gray-500">
              Copyright (C) 2026 Rideshare.Click
            </p>
          </div>

          <div className="prose max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
            <section className="bg-gray-50 rounded-lg p-6 mb-6">
              <p className="mb-3">
                This program is free software: you can redistribute it and/or modify
                it under the terms of the GNU General Public License as published by
                the Free Software Foundation, either version 3 of the License, or
                (at your option) any later version.
              </p>
              <p className="mb-3">
                This program is distributed in the hope that it will be useful,
                but WITHOUT ANY WARRANTY; without even the implied warranty of
                MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
                GNU General Public License for more details.
              </p>
              <p>
                You should have received a copy of the GNU General Public License
                along with this program.  If not, see{' '}
                <a
                  href="https://www.gnu.org/licenses/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  https://www.gnu.org/licenses/
                </a>
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Preamble</h3>
              <p className="mb-3">
                The GNU General Public License is a free, copyleft license for
                software and other kinds of works.
              </p>
              <p className="mb-3">
                The licenses for most software and other practical works are designed
                to take away your freedom to share and change the works.  By contrast,
                the GNU General Public License is intended to guarantee your freedom to
                share and change all versions of a program--to make sure it remains free
                software for all its users.  We, the Free Software Foundation, use the
                GNU General Public License for most of our software; it applies also to
                any other work released this way by its authors.  You can apply it to
                your programs, too.
              </p>
              <p className="mb-3">
                When we speak of free software, we are referring to freedom, not
                price.  Our General Public Licenses are designed to make sure that you
                have the freedom to distribute copies of free software (and charge for
                them if you wish), that you receive source code or can get it if you
                want it, that you can change the software or use pieces of it in new
                free programs, and that you know you can do these things.
              </p>
              <p>
                To protect your rights, we need to prevent others from denying you
                these rights or asking you to surrender the rights.  Therefore, you have
                certain responsibilities if you distribute copies of the software, or if
                you modify it: responsibilities to respect the freedom of others.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">TERMS AND CONDITIONS</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">0. Definitions.</h4>
                  <p className="mb-2">
                    "This License" refers to version 3 of the GNU General Public License.
                  </p>
                  <p className="mb-2">
                    "Copyright" also means copyright-like laws that apply to other kinds of
                    works, such as semiconductor masks.
                  </p>
                  <p>
                    "The Program" refers to any copyrightable work licensed under this
                    License.  Each licensee is addressed as "you".  "Licensees" and
                    "recipients" may be individuals or organizations.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">1. Source Code.</h4>
                  <p className="mb-2">
                    The "source code" for a work means the preferred form of the work
                    for making modifications to it.  "Object code" means any non-source
                    form of a work.
                  </p>
                  <p>
                    The "Corresponding Source" for a work in object code form means all
                    the source code needed to generate, install, and (for an executable
                    work) run the object code and to modify the work, including scripts to
                    control those activities.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">2. Basic Permissions.</h4>
                  <p className="mb-2">
                    All rights granted under this License are granted for the term of
                    copyright on the Program, and are irrevocable provided the stated
                    conditions are met.  This License explicitly affirms your unlimited
                    permission to run the unmodified Program.
                  </p>
                  <p>
                    You may make, run and propagate covered works that you do not
                    convey, without conditions so long as your license otherwise remains
                    in force.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">4. Conveying Verbatim Copies.</h4>
                  <p className="mb-2">
                    You may convey verbatim copies of the Program's source code as you
                    receive it, in any medium, provided that you conspicuously and
                    appropriately publish on each copy an appropriate copyright notice;
                    keep intact all notices stating that this License and any
                    non-permissive terms added in accord with section 7 apply to the code;
                    keep intact all notices of the absence of any warranty; and give all
                    recipients a copy of this License along with the Program.
                  </p>
                  <p>
                    You may charge any price or no price for each copy that you convey,
                    and you may offer support or warranty protection for a fee.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">5. Conveying Modified Source Versions.</h4>
                  <p className="mb-2">
                    You may convey a work based on the Program, or the modifications to
                    produce it from the Program, in the form of source code under the
                    terms of section 4, provided that you also meet all of these conditions:
                  </p>
                  <ul className="list-disc pl-6 space-y-2 mb-2">
                    <li>The work must carry prominent notices stating that you modified it, and giving a relevant date.</li>
                    <li>The work must carry prominent notices stating that it is released under this License.</li>
                    <li>You must license the entire work, as a whole, under this License to anyone who comes into possession of a copy.</li>
                  </ul>
                  <p>
                    A compilation of a covered work with other separate and independent
                    works, which are not by their nature extensions of the covered work,
                    and which are not combined with it such as to form a larger program,
                    in or on a volume of a storage or distribution medium, is called an
                    "aggregate" if the compilation and its resulting copyright are not
                    used to limit the access or legal rights of the compilation's users
                    beyond what the individual works permit.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">15. Disclaimer of Warranty.</h4>
                  <p className="mb-2 font-semibold">
                    THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY
                    APPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT
                    HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY
                    OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO,
                    THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
                    PURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM
                    IS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF
                    ALL NECESSARY SERVICING, REPAIR OR CORRECTION.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-2">16. Limitation of Liability.</h4>
                  <p className="font-semibold">
                    IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING
                    WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MODIFIES AND/OR CONVEYS
                    THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES, INCLUDING ANY
                    GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE
                    USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED TO LOSS OF
                    DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY YOU OR THIRD
                    PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER PROGRAMS),
                    EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF
                    SUCH DAMAGES.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 rounded-lg p-6 mt-6">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Full License Text</h3>
              <p className="mb-3">
                This is a summary of the GNU General Public License v3. For the complete
                license text, please visit:
              </p>
              <p>
                <a
                  href="https://www.gnu.org/licenses/gpl-3.0.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline font-medium"
                >
                  https://www.gnu.org/licenses/gpl-3.0.html
                </a>
              </p>
              <p className="mt-4 text-sm">
                You may also obtain a copy of the license from the Free Software Foundation,
                Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
              </p>
            </section>

            <div className="text-sm text-gray-500 mt-8 pt-6 border-t border-gray-200">
              <p><strong>License Version:</strong> GNU General Public License v3.0</p>
              <p><strong>Copyright:</strong> (C) 2026 Rideshare.Click</p>
              <p className="mt-2">
                This program is free software licensed under the GNU GPL v3.0. See the full
                license text at{' '}
                <a
                  href="https://www.gnu.org/licenses/gpl-3.0.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  gnu.org/licenses/gpl-3.0.html
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
