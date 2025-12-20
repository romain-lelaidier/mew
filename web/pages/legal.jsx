import { Layout } from "../components/layout";

export default function App() {
  return (
    <Layout>
      <div class="[&_h3]:text-2xl [&_h5]:font-bold [&_h5]:mt-2">
        <div>
          <h3>Terms of Service</h3>
          Effective Date: June 16, 2025<br/>
          Welcome to Mew. By using this website, you agree to the following terms and conditions. If you do not agree with these terms, please do not use the Service.

          <h5>1. Use of the Service</h5>
          The Service allows users to listen publicly available YouTube Music songs and albums through an ad-free interface.<br/>
          You agree to use the Service in compliance with all applicable laws and regulations, including copyright and intellectual property laws.<br/>
          You are solely responsible for how you use the Service and any consequences thereof.

          <h5>2. No Affiliation</h5>
          This website is not affiliated, endorsed, or supported by YouTube, Google LLC, or any related entity.<br/>
          All content is served via YouTube's servers and remains the property of their respective owners.

          <h5>3. Disclaimer of Liability</h5>
          The Service is provided "as is" and "as available" without any warranties, express or implied.<br/>
          Mew does not guarantee the accuracy, availability, or legality of any content accessed through the Service.<br/>
          You assume full responsibility for your use of the Service. Under no circumstances shall Mew be held liable for any direct, indirect, or consequential damages arising from your use of the Service. You agree that you are solely responsible for all acts and omissions that occur as a result of your use of the Website.

          <h5>4. Prohibited Uses</h5>
          Do not use the Service to access or distribute content illegally or to circumvent YouTube's terms of service.<br/>
          Do not attempt to download or reproduce content unless explicitly allowed by YouTube.

          <h5>5. Modifications and Termination</h5>
          We may update or discontinue the Service at any time without notice.<br/>
          Continued use of the Service after changes constitutes acceptance of the new terms.
        </div>
        <div>
          <h3>Privacy Policy</h3>
          Effective Date: June 16, 2025<br/>

          <h5>1. No Data Collection</h5>
          This website does not collect, store, or share any personal information.<br/>
          We do not use cookies, analytics trackers, or any form of user profiling.

          <h5>2. Anonymous Access</h5>
          All users remain completely anonymous when using the Service.<br/>
          No personally identifiable information (PII) is processed or stored on our servers.

          <h5>3. Third-Party Content</h5>
          Audios, image covers and content data are streamed directly from YouTube.<br/>
          Please note that YouTube may collect data according to their own privacy policy when videos are accessed or embedded.

          <h5>4. Security</h5>
          While we do not process user data, we still implement technical measures to ensure secure delivery of the Service.

          <h5>5. Contact</h5>
          For questions about this Privacy Policy, you may contact the developper at <a href="mailto:romain.lelaidier@etu.minesparis.psl.eu">romain.lelaidier@etu.minesparis.psl.eu</a>.
        </div>
      </div>
    </Layout>
  )
}