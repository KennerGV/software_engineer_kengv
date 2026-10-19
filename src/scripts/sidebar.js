const handleMobileAccordion = () => {
  const detailsContact = document.getElementById("contact-details");
  const detailsEducation = document.getElementById("education-details");
  if (!detailsContact || !detailsEducation) return;

  if (window.innerWidth <= 1024) {
    detailsContact.setAttribute("open", "true");
    detailsEducation.setAttribute("open", "true");
  }
};

handleMobileAccordion();
window.addEventListener("resize", handleMobileAccordion);

const btn = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
const container = document.querySelector(".app-container");

btn?.addEventListener("click", () => {
  sidebar?.classList.toggle("is-open");
  container?.classList.toggle("sidebar-open");
});

document.querySelectorAll(".nav-item").forEach((link) => {
  link.addEventListener("click", () => {
    sidebar?.classList.remove("is-open");
    container?.classList.remove("sidebar-open");
  });
});
