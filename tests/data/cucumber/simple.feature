Feature: App
  In order to test the fibonacci app
  I want to be able to manipulate the browser

  Scenario: Loading the app
    Given the relative url ../app/app.html
	When I open the page
	And I click "next"
    Then I should see "Fibonacci" as the page title

  Scenario: Clicking next
    Given a running app
	When I click "next"
	When I click "next"
	When I click "next"
	Then I should see "3" in the output field
